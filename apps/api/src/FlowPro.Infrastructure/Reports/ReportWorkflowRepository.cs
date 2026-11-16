using System.Globalization;
using System.Text.Json;
using FlowPro.Application.Reports;
using FlowPro.Domain.Attendance;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Organization;
using FlowPro.Domain.Policies;
using FlowPro.Domain.Sync;
using FlowPro.Domain.Timesheets;
using FlowPro.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Infrastructure.Reports;

internal sealed class ReportWorkflowRepository(FlowProDbContext dbContext) : IReportWorkflowRepository
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<ReportWorkflowSnapshot> GetSnapshotAsync(
        Guid tenantId,
        string periodMonth,
        CancellationToken cancellationToken)
    {
        List<Membership> users = await dbContext.Users.AsNoTracking()
            .Where(user => user.TenantId == tenantId)
            .ToListAsync(cancellationToken);
        List<Employee> employees = await dbContext.Employees.AsNoTracking()
            .Where(employee => employee.TenantId == tenantId)
            .ToListAsync(cancellationToken);
        List<UserRole> userRoles = await dbContext.UserRoles.AsNoTracking()
            .Where(userRole => userRole.TenantId == tenantId)
            .ToListAsync(cancellationToken);
        List<Role> roles = await dbContext.Roles.AsNoTracking()
            .Where(role => role.TenantId == tenantId)
            .ToListAsync(cancellationToken);
        List<Team> teams = await dbContext.Teams.AsNoTracking()
            .Where(team => team.TenantId == tenantId)
            .ToListAsync(cancellationToken);
        List<MonthlyTimesheetSnapshot> approvals = await dbContext.MonthlyTimesheetSnapshots.AsNoTracking()
            .Where(snapshot => snapshot.TenantId == tenantId && snapshot.PeriodMonth == periodMonth)
            .ToListAsync(cancellationToken);
        DateTimeOffset periodStart = DateTimeOffset.Parse(
            $"{periodMonth}-01T00:00:00.000Z",
            CultureInfo.InvariantCulture);
        DateTimeOffset periodEnd = periodStart.AddMonths(1);
        List<TimeBooking> nativeBookings = await dbContext.TimeBookings.AsNoTracking()
            .Where(booking => booking.TenantId == tenantId
                && !booking.IsVoided
                && booking.OccurredAt >= periodStart
                && booking.OccurredAt < periodEnd)
            .ToListAsync(cancellationToken);
        List<ClientAggregate> aggregates = await dbContext.ClientAggregates.AsNoTracking()
            .Where(aggregate => aggregate.TenantId == tenantId
                && !aggregate.IsDeleted
                && (aggregate.AggregateType == "clock-event" || aggregate.AggregateType == "request"))
            .ToListAsync(cancellationToken);
        AttendancePolicyVersion? policy = await dbContext.AttendancePolicyVersions.AsNoTracking()
            .Where(version => version.TenantId == tenantId
                && version.PolicyId == "default"
                && version.IsCurrent)
            .OrderByDescending(version => version.VersionNumber)
            .FirstOrDefaultAsync(cancellationToken);

        Dictionary<Guid, Employee> employeesByUserId = employees.ToDictionary(employee => employee.UserId);
        Dictionary<Guid, Role> rolesById = roles.ToDictionary(role => role.Id);
        Dictionary<Guid, Team> teamsById = teams.ToDictionary(team => team.Id);
        Dictionary<Guid, Role> rolesByUserId = userRoles
            .GroupBy(userRole => userRole.UserId)
            .Select(group => group.First())
            .Where(userRole => rolesById.ContainsKey(userRole.RoleId))
            .ToDictionary(userRole => userRole.UserId, userRole => rolesById[userRole.RoleId]);

        ReportEmployeeDto[] reportUsers = users
            .Where(user => employeesByUserId.ContainsKey(user.Id))
            .Select(user =>
            {
                Employee employee = employeesByUserId[user.Id];
                Role? role = rolesByUserId.GetValueOrDefault(user.Id);
                Team? team = employee.TeamId is Guid teamId ? teamsById.GetValueOrDefault(teamId) : null;

                return new ReportEmployeeDto(
                    user.ExternalSubject,
                    employee.GivenName,
                    employee.FamilyName,
                    user.ExternalSubject,
                    user.Email,
                    string.Empty,
                    MapStatus(user.Status),
                    role?.Key ?? "employee",
                    null,
                    team?.Name ?? "Unassigned",
                    string.Empty,
                    "full-time",
                    "team",
                    null,
                    null,
                    user.Status == UserStatus.Inactive ? user.UpdatedAt : null,
                    null,
                    null,
                    null,
                    user.CreatedAt,
                    user.UpdatedAt);
            })
            .OrderBy(user => user.Status == "active" ? 0 : 1)
            .ThenBy(user => user.FirstName)
            .ThenBy(user => user.LastName)
            .ToArray();
        Dictionary<Guid, string> externalUserIdsById = users.ToDictionary(user => user.Id, user => user.ExternalSubject);
        JsonElement[] compatibilityClockEvents = aggregates
            .Where(aggregate => aggregate.AggregateType == "clock-event")
            .Select(aggregate => ToJsonElement(aggregate.PayloadJson))
            .ToArray();
        HashSet<string> compatibilityClockEventIds = compatibilityClockEvents
            .Select(TryReadId)
            .OfType<string>()
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        JsonElement[] nativeClockEvents = nativeBookings
            .Where(booking => externalUserIdsById.ContainsKey(booking.EmployeeId)
                && !compatibilityClockEventIds.Contains(booking.Id.ToString()))
            .Select(booking => ToJsonElement(JsonSerializer.Serialize(
                new
                {
                    id = booking.Id.ToString(),
                    employeeId = externalUserIdsById[booking.EmployeeId],
                    type = MapBookingType(booking.Type),
                    occurredAt = booking.OccurredAt,
                    location = booking.Location is null ? null : MapLocation(booking.Location.Value),
                    source = MapSource(booking.Source),
                    syncState = "synced",
                },
                JsonOptions)))
            .ToArray();
        JsonElement[] clockEvents = [.. compatibilityClockEvents, .. nativeClockEvents];
        JsonElement[] requests = aggregates
            .Where(aggregate => aggregate.AggregateType == "request")
            .Select(aggregate => ToJsonElement(aggregate.PayloadJson))
            .ToArray();
        MonthlyReportApprovalDto[] approvalDtos = approvals
            .Select(MapApproval)
            .ToArray();
        JsonElement? policyElement = policy is null ? null : ToJsonElement(policy.ConfigJson);

        return new ReportWorkflowSnapshot(
            reportUsers,
            clockEvents,
            requests,
            approvalDtos,
            policyElement);
    }

    private static MonthlyReportApprovalDto MapApproval(MonthlyTimesheetSnapshot snapshot) =>
        new(
            $"{snapshot.EmployeeExternalId}-{snapshot.PeriodMonth}",
            snapshot.EmployeeExternalId,
            snapshot.PeriodMonth,
            snapshot.Status,
            snapshot.SignedByExternalId,
            snapshot.SignedByName,
            snapshot.SignedAt,
            snapshot.Note,
            snapshot.PayrollExportedAt,
            snapshot.PdfExportedAt,
            snapshot.UpdatedAt);

    private static JsonElement ToJsonElement(string json) =>
        JsonSerializer.Deserialize<JsonElement>(json, JsonOptions);

    private static string? TryReadId(JsonElement element) =>
        element.ValueKind == JsonValueKind.Object
            && element.TryGetProperty("id", out JsonElement id)
            && id.ValueKind == JsonValueKind.String
                ? id.GetString()
                : null;

    private static string MapBookingType(TimeBookingType type) =>
        type switch
        {
            TimeBookingType.ClockIn => "clock-in",
            TimeBookingType.StartBreak => "start-break",
            TimeBookingType.ResumeWork => "resume-work",
            TimeBookingType.ClockOut => "clock-out",
            _ => "clock-in",
        };

    private static string MapLocation(WorkLocation location) =>
        location switch
        {
            WorkLocation.HomeOffice => "home-office",
            _ => "office",
        };

    private static string MapSource(BookingSource source) =>
        source switch
        {
            BookingSource.Manual => "manual",
            BookingSource.Mobile => "mobile",
            BookingSource.Terminal => "terminal",
            BookingSource.System => "system",
            _ => "user",
        };

    private static string MapStatus(UserStatus status) =>
        status switch
        {
            UserStatus.Active => "active",
            UserStatus.Invited => "invited",
            UserStatus.Inactive => "inactive",
            _ => "inactive",
        };
}
