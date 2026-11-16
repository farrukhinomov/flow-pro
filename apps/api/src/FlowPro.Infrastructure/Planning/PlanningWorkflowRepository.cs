using System.Text.Json;
using FlowPro.Application.Planning;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Organization;
using FlowPro.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Infrastructure.Planning;

internal sealed class PlanningWorkflowRepository(FlowProDbContext dbContext) : IPlanningWorkflowRepository
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<PlanningWorkflowSnapshot> GetSnapshotAsync(
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
        List<string> requestPayloads = await dbContext.ClientAggregates.AsNoTracking()
            .Where(aggregate => aggregate.TenantId == tenantId
                && !aggregate.IsDeleted
                && aggregate.AggregateType == "request")
            .Select(aggregate => aggregate.PayloadJson)
            .ToListAsync(cancellationToken);
        List<JsonElement> requests = requestPayloads
            .Select(ToJsonElement)
            .Where(request => RequestTouchesPeriod(request, periodMonth))
            .ToList();

        Dictionary<Guid, Employee> employeesByUserId = employees.ToDictionary(employee => employee.UserId);
        Dictionary<Guid, Role> rolesById = roles.ToDictionary(role => role.Id);
        Dictionary<Guid, Team> teamsById = teams.ToDictionary(team => team.Id);
        Dictionary<Guid, Role> rolesByUserId = userRoles
            .GroupBy(userRole => userRole.UserId)
            .Select(group => group.First())
            .Where(userRole => rolesById.ContainsKey(userRole.RoleId))
            .ToDictionary(userRole => userRole.UserId, userRole => rolesById[userRole.RoleId]);
        PlanningEmployeeDto[] employeesDto = users
            .Where(user => employeesByUserId.ContainsKey(user.Id))
            .Select(user =>
            {
                Employee employee = employeesByUserId[user.Id];
                Role? role = rolesByUserId.GetValueOrDefault(user.Id);
                Team? team = employee.TeamId is Guid teamId ? teamsById.GetValueOrDefault(teamId) : null;

                return new PlanningEmployeeDto(
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
            .ToArray();

        return new PlanningWorkflowSnapshot(employeesDto, requests);
    }

    private static JsonElement ToJsonElement(string json) =>
        JsonSerializer.Deserialize<JsonElement>(json, JsonOptions);

    private static bool RequestTouchesPeriod(JsonElement request, string periodMonth)
    {
        if (request.ValueKind != JsonValueKind.Object
            || !request.TryGetProperty("fromDate", out JsonElement fromDate)
            || !request.TryGetProperty("toDate", out JsonElement toDate)
            || fromDate.ValueKind != JsonValueKind.String
            || toDate.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        string periodStart = $"{periodMonth}-01";
        string periodEnd = $"{periodMonth}-31";

        return string.CompareOrdinal(toDate.GetString(), periodStart) >= 0
            && string.CompareOrdinal(fromDate.GetString(), periodEnd) <= 0;
    }

    private static string MapStatus(UserStatus status) =>
        status switch
        {
            UserStatus.Active => "active",
            UserStatus.Invited => "invited",
            UserStatus.Inactive => "inactive",
            _ => "inactive",
        };
}
