using System.Globalization;
using System.Text.Json;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;

namespace FlowPro.Application.Planning;

public sealed class PlanningWorkflowHandler(
    ICurrentRequestContext requestContext,
    IPermissionChecker permissionChecker,
    IPlanningWorkflowRepository repository,
    TimeProvider timeProvider) : IQueryHandler<GetPlanningPackageQuery, PlanningPackageDto>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly Dictionary<string, StatusMetadata> StatusMetadataByCode =
        new Dictionary<string, StatusMetadata>(StringComparer.OrdinalIgnoreCase)
        {
            ["HO"] = new("remote", "#c026d3"),
            ["VAC"] = new("leave", "#10b981"),
            ["URL"] = new("leave", "#10b981"),
            ["SICK"] = new("sickness", "#f59e0b"),
            ["KR"] = new("sickness", "#f59e0b"),
            ["OFF"] = new("unavailable", "#64748b"),
            ["AZ"] = new("unavailable", "#64748b"),
        };

    public async Task<PlanningPackageDto> HandleAsync(
        GetPlanningPackageQuery query,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        await RequirePlanningAccessAsync(identity, cancellationToken);

        string periodMonth = NormalizePeriodMonth(query.PeriodMonth);
        PlanningWorkflowSnapshot snapshot = await repository.GetSnapshotAsync(
            identity.TenantId,
            periodMonth,
            cancellationToken);
        RequestDocument[] requests = snapshot.Requests
            .Select(TryDeserialize<RequestDocument>)
            .OfType<RequestDocument>()
            .ToArray();
        PlanningPersonDto[] people = snapshot.Employees
            .Where(employee => !employee.Status.Equals("inactive", StringComparison.OrdinalIgnoreCase))
            .OrderBy(employee => employee.LastName)
            .ThenBy(employee => employee.FirstName)
            .Select(employee => BuildPerson(employee, requests))
            .ToArray();

        return new PlanningPackageDto(
            periodMonth,
            timeProvider.GetUtcNow(),
            people,
            snapshot.Requests);
    }

    private async Task RequirePlanningAccessAsync(
        RequestIdentity identity,
        CancellationToken cancellationToken)
    {
        bool canManageTimesheets = await permissionChecker.HasPermissionAsync(
            identity.TenantId,
            identity.UserId,
            PermissionKeys.TimesheetsManage,
            cancellationToken);
        bool canApproveRequests = await permissionChecker.HasPermissionAsync(
            identity.TenantId,
            identity.UserId,
            PermissionKeys.RequestsApprove,
            cancellationToken);
        bool canManagePayroll = await permissionChecker.HasPermissionAsync(
            identity.TenantId,
            identity.UserId,
            PermissionKeys.PayrollExportsManage,
            cancellationToken);

        if (!canManageTimesheets && !canApproveRequests && !canManagePayroll)
        {
            throw new FlowProForbiddenException(
                "planning.manage_required",
                "Viewing team planning requires request approval, timesheet, or payroll permissions.");
        }
    }

    private static PlanningPersonDto BuildPerson(
        PlanningEmployeeDto employee,
        IReadOnlyList<RequestDocument> requests)
    {
        PlanningEntryDto[] entries = requests
            .Where(request => RequestBelongsToUser(request, employee) && IsPlanningRequest(request))
            .SelectMany(BuildEntries)
            .OrderBy(entry => entry.Date)
            .ToArray();

        return new PlanningPersonDto(
            employee.Id,
            $"{employee.LastName}, {employee.FirstName}",
            $"{employee.FirstName} {employee.LastName}",
            employee.WorkPattern,
            employee.Team,
            entries,
            employee);
    }

    private static IEnumerable<PlanningEntryDto> BuildEntries(RequestDocument request)
    {
        if (!TryReadDate(request.FromDate, out DateOnly from) || !TryReadDate(request.ToDate, out DateOnly to) || to < from)
        {
            yield break;
        }

        StatusMetadata metadata = GetStatusMetadata(request.StatusCode);
        bool isSensitive = metadata.Category == "sickness";
        string visibility = isSensitive ? "state-only" : "operational";
        string? label = isSensitive ? null : request.StatusLabel ?? request.Subtype;

        for (DateOnly date = from; date <= to; date = date.AddDays(1))
        {
            yield return new PlanningEntryDto(
                date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                request.StatusCode,
                label,
                metadata.Color,
                metadata.Category,
                visibility,
                isSensitive,
                request.Status == "submitted");
        }
    }

    private static bool IsPlanningRequest(RequestDocument request) =>
        request.Kind != "booking-correction"
        && request.Status != "cancelled"
        && request.Status != "rejected"
        && !string.IsNullOrWhiteSpace(request.StatusCode);

    private static bool RequestBelongsToUser(RequestDocument request, PlanningEmployeeDto employee)
    {
        string fullName = $"{employee.FirstName} {employee.LastName}";

        return request.EmployeeId == employee.Id
            || request.EmployeeName.Equals(fullName, StringComparison.OrdinalIgnoreCase);
    }

    private static StatusMetadata GetStatusMetadata(string? code) =>
        code is not null && StatusMetadataByCode.TryGetValue(code, out StatusMetadata? metadata)
            ? metadata
            : new("custom", "#3b82f6");

    private static T? TryDeserialize<T>(JsonElement element)
    {
        try
        {
            return element.Deserialize<T>(JsonOptions);
        }
        catch (JsonException)
        {
            return default;
        }
    }

    private static bool TryReadDate(string value, out DateOnly date) =>
        DateOnly.TryParseExact(
            value.Length >= 10 ? value[..10] : value,
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out date);

    private static string NormalizePeriodMonth(string periodMonth)
    {
        string normalized = periodMonth.Trim();
        if (!DateOnly.TryParseExact(
                $"{normalized}-01",
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out _))
        {
            throw new FlowProValidationException(
                "planning.period_month.invalid",
                "Planning period must be formatted as yyyy-MM.");
        }

        return normalized;
    }

    private sealed record RequestDocument(
        string Id,
        string Kind,
        string EmployeeId,
        string EmployeeName,
        string FromDate,
        string ToDate,
        string? StatusCode,
        string? StatusLabel,
        string Subtype,
        string Status);

    private sealed record StatusMetadata(string Category, string Color);
}
