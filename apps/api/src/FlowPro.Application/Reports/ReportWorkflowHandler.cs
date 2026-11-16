using System.Globalization;
using System.Text.Json;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Domain.Attendance;

namespace FlowPro.Application.Reports;

public sealed class ReportWorkflowHandler(
    ICurrentRequestContext requestContext,
    IPermissionChecker permissionChecker,
    IReportWorkflowRepository repository,
    TimeProvider timeProvider) : IQueryHandler<GetReportsPackageQuery, ReportsPackageDto>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    /// <summary>ArbZG § 4, used when the tenant has stored no break policy of its own.</summary>
    private static readonly IReadOnlyList<BreakPolicyDocument> StatutoryBreakPolicy =
    [
        new BreakPolicyDocument(6, 30),
        new BreakPolicyDocument(9, 45),
    ];

    public async Task<ReportsPackageDto> HandleAsync(
        GetReportsPackageQuery query,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        await RequireReportsAccessAsync(identity, cancellationToken);

        string periodMonth = NormalizePeriodMonth(query.PeriodMonth);
        ReportWorkflowSnapshot snapshot = await repository.GetSnapshotAsync(
            identity.TenantId,
            periodMonth,
            cancellationToken);

        AttendancePolicyDocument policy = ParsePolicy(snapshot.Policy);
        IReadOnlyList<ClockEventDocument> clockEvents = snapshot.ClockEvents
            .Select(TryDeserialize<ClockEventDocument>)
            .OfType<ClockEventDocument>()
            .ToArray();
        IReadOnlyList<RequestDocument> requests = snapshot.Requests
            .Select(TryDeserialize<RequestDocument>)
            .OfType<RequestDocument>()
            .ToArray();
        DateOnly periodStart = DateOnly.ParseExact($"{periodMonth}-01", "yyyy-MM-dd", CultureInfo.InvariantCulture);
        int daysInMonth = DateTime.DaysInMonth(periodStart.Year, periodStart.Month);
        DateOnly periodEnd = new(periodStart.Year, periodStart.Month, daysInMonth);
        DateOnly[] days = Enumerable.Range(1, daysInMonth)
            .Select(day => new DateOnly(periodStart.Year, periodStart.Month, day))
            .ToArray();
        Dictionary<string, IReadOnlyList<ClockEventDocument>> eventsByEmployeeAndDay = clockEvents
            .Where(item => TryReadDate(item.OccurredAt, out DateOnly occurredOn)
                && occurredOn >= periodStart
                && occurredOn <= periodEnd)
            .GroupBy(item => $"{item.EmployeeId}:{item.OccurredAt[..10]}")
            .ToDictionary(group => group.Key, group => (IReadOnlyList<ClockEventDocument>)group.ToArray());
        IReadOnlyDictionary<string, MonthlyReportApprovalDto> approvalsByEmployee = snapshot.Approvals
            .Where(approval => approval.PeriodMonth == periodMonth)
            .GroupBy(approval => approval.EmployeeId)
            .ToDictionary(group => group.Key, group => group.OrderByDescending(item => item.UpdatedAt).First());
        ReportEmployeeDto[] activeEmployees = snapshot.Employees
            .Where(employee => !employee.Status.Equals("inactive", StringComparison.OrdinalIgnoreCase))
            .OrderBy(employee => employee.FirstName)
            .ThenBy(employee => employee.LastName)
            .ToArray();

        EmployeePayrollReportDto[] employeeReports = activeEmployees
            .Select(employee => BuildEmployeeReport(
                employee,
                days,
                policy,
                requests,
                eventsByEmployeeAndDay,
                approvalsByEmployee.GetValueOrDefault(employee.Id),
                periodMonth))
            .ToArray();
        AbsenceBalanceReportDto[] absenceBalances = activeEmployees
            .Select(employee => BuildAbsenceBalance(employee, requests, policy, periodMonth))
            .ToArray();
        TeamReportDto[] teamReports = BuildTeamReports(activeEmployees, employeeReports, requests, periodStart, periodEnd);

        return new ReportsPackageDto(
            periodMonth,
            timeProvider.GetUtcNow(),
            employeeReports,
            absenceBalances,
            teamReports);
    }

    private async Task RequireReportsAccessAsync(
        RequestIdentity identity,
        CancellationToken cancellationToken)
    {
        bool canManageTimesheets = await permissionChecker.HasPermissionAsync(
            identity.TenantId,
            identity.UserId,
            PermissionKeys.TimesheetsManage,
            cancellationToken);
        bool canManagePayroll = await permissionChecker.HasPermissionAsync(
            identity.TenantId,
            identity.UserId,
            PermissionKeys.PayrollExportsManage,
            cancellationToken);

        if (!canManageTimesheets && !canManagePayroll)
        {
            throw new FlowProForbiddenException(
                "reports.manage_required",
                "Viewing payroll reports requires timesheet or payroll export permissions.");
        }
    }

    private static EmployeePayrollReportDto BuildEmployeeReport(
        ReportEmployeeDto employee,
        IReadOnlyList<DateOnly> days,
        AttendancePolicyDocument policy,
        IReadOnlyList<RequestDocument> requests,
        IReadOnlyDictionary<string, IReadOnlyList<ClockEventDocument>> eventsByEmployeeAndDay,
        MonthlyReportApprovalDto? approval,
        string periodMonth)
    {
        string employeeName = FullName(employee);
        PayrollReportDayDto[] reportDays = days
            .Select(date =>
            {
                string isoDate = date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                string? holiday = GetHolidayName(isoDate, policy);
                decimal targetHours = GetTargetHoursForDate(policy, date);
                RequestDocument? absence = GetApprovedAbsenceForDay(employee.Id, date, requests);
                ClockProjection projection = ProjectClockEvents(
                    eventsByEmployeeAndDay.GetValueOrDefault($"{employee.Id}:{isoDate}") ?? []);
                decimal breakRequiredHours = GetBreakRequiredHours(
                    projection.WorkedHours,
                    policy.LegalBreaks);
                decimal paidHours = projection.WorkedHours > 0
                    ? projection.WorkedHours
                    : absence is not null || (holiday is not null && targetHours > 0)
                        ? targetHours
                        : 0;
                string status = string.Join(
                    " · ",
                    new[] { holiday, absence?.StatusCode ?? absence?.Subtype, projection.Label }
                        .Where(value => !string.IsNullOrWhiteSpace(value)));

                return new PayrollReportDayDto(
                    isoDate,
                    employee.Id,
                    employeeName,
                    status.Length > 0 ? status : targetHours > 0 ? "Workday" : "Non-working day",
                    projection.WorkedHours,
                    paidHours,
                    targetHours,
                    paidHours - targetHours,
                    projection.BreakHours,
                    breakRequiredHours,
                    projection.BreakHours >= breakRequiredHours);
            })
            .ToArray();
        PayrollReportTotalsDto totals = reportDays.Aggregate(
            new PayrollReportTotalsDto(0, 0, 0, 0, 0, 0),
            (sum, day) => new PayrollReportTotalsDto(
                sum.WorkedHours + day.WorkedHours,
                sum.PaidHours + day.PaidHours,
                sum.TargetHours + day.TargetHours,
                sum.FlexHours + day.FlexHours,
                sum.BreakHours + day.BreakHours,
                sum.ComplianceIssues + (day.BreakCompliant ? 0 : 1)));

        return new EmployeePayrollReportDto(employee, approval, reportDays, totals);
    }

    private static AbsenceBalanceReportDto BuildAbsenceBalance(
        ReportEmployeeDto employee,
        IReadOnlyList<RequestDocument> requests,
        AttendancePolicyDocument policy,
        string periodMonth)
    {
        DateOnly periodStart = DateOnly.ParseExact($"{periodMonth}-01", "yyyy-MM-dd", CultureInfo.InvariantCulture);
        RequestDocument[] employeeRequests = requests
            .Where(request => request.EmployeeId == employee.Id && request.Kind == "absence")
            .ToArray();
        decimal approvedVacationDays = employeeRequests
            .Where(request => request.Status == "approved"
                && request.StatusCode == "VAC"
                && TryReadDate(request.ToDate, out DateOnly to)
                && to < periodStart)
            .Sum(request => CountBusinessDays(request.FromDate, request.ToDate));
        decimal plannedVacationDays = employeeRequests
            .Where(request => (request.Status == "approved" || request.Status == "submitted")
                && request.StatusCode == "VAC"
                && TryReadDate(request.ToDate, out DateOnly to)
                && to >= periodStart)
            .Sum(request => CountBusinessDays(request.FromDate, request.ToDate));
        decimal sicknessDays = employeeRequests
            .Where(request => request.StatusCode == "SICK")
            .Sum(request => CountBusinessDays(request.FromDate, request.ToDate));
        decimal homeOfficeDays = employeeRequests
            .Where(request => (request.Status == "approved" || request.Status == "submitted")
                && request.StatusCode == "HO")
            .Sum(request => CountBusinessDays(request.FromDate, request.ToDate));

        return new AbsenceBalanceReportDto(
            employee.Id,
            FullName(employee),
            policy.VacationAnnualDays,
            approvedVacationDays,
            plannedVacationDays,
            Math.Max(0, policy.VacationAnnualDays - approvedVacationDays - plannedVacationDays),
            sicknessDays,
            homeOfficeDays);
    }

    private static TeamReportDto[] BuildTeamReports(
        IReadOnlyList<ReportEmployeeDto> employees,
        IReadOnlyList<EmployeePayrollReportDto> employeeReports,
        IReadOnlyList<RequestDocument> requests,
        DateOnly periodStart,
        DateOnly periodEnd)
    {
        Dictionary<string, ReportEmployeeDto> employeesById = employees.ToDictionary(employee => employee.Id);

        return employees
            .Select(employee => string.IsNullOrWhiteSpace(employee.Team) ? "Unassigned" : employee.Team)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(team => team)
            .Select(team =>
            {
                EmployeePayrollReportDto[] teamEmployeeReports = employeeReports
                    .Where(report => (string.IsNullOrWhiteSpace(report.Employee.Team) ? "Unassigned" : report.Employee.Team)
                        .Equals(team, StringComparison.OrdinalIgnoreCase))
                    .ToArray();
                decimal approvedAbsenceDays = requests
                    .Where(request =>
                        employeesById.TryGetValue(request.EmployeeId, out ReportEmployeeDto? employee)
                        && (string.IsNullOrWhiteSpace(employee.Team) ? "Unassigned" : employee.Team)
                            .Equals(team, StringComparison.OrdinalIgnoreCase)
                        && request.Kind == "absence"
                        && request.Status == "approved"
                        && TryReadDate(request.FromDate, out DateOnly from)
                        && TryReadDate(request.ToDate, out DateOnly to)
                        && to >= periodStart
                        && from <= periodEnd)
                    .Sum(request => CountBusinessDays(request.FromDate, request.ToDate));

                return new TeamReportDto(
                    team,
                    teamEmployeeReports.Length,
                    teamEmployeeReports.Count(report => report.Approval?.Status == "signed"),
                    teamEmployeeReports.Count(report => report.Approval?.Status != "signed"),
                    teamEmployeeReports.Sum(report => report.Totals.WorkedHours),
                    teamEmployeeReports.Sum(report => report.Totals.TargetHours),
                    teamEmployeeReports.Sum(report => report.Totals.FlexHours),
                    teamEmployeeReports.Sum(report => report.Totals.ComplianceIssues),
                    approvedAbsenceDays);
            })
            .ToArray();
    }

    private static ClockProjection ProjectClockEvents(IReadOnlyList<ClockEventDocument> events)
    {
        ClockEventDocument[] sorted = events
            .Where(item => DateTimeOffset.TryParse(item.OccurredAt, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out _))
            .OrderBy(item => DateTimeOffset.Parse(item.OccurredAt, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal))
            .ToArray();
        ClockEventDocument? activeStart = null;
        ClockEventDocument? breakStart = null;
        TimeSpan worked = TimeSpan.Zero;
        TimeSpan breaks = TimeSpan.Zero;
        List<string> labels = [];

        foreach (ClockEventDocument clockEvent in sorted)
        {
            DateTimeOffset occurredAt = DateTimeOffset.Parse(
                clockEvent.OccurredAt,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal);

            if (clockEvent.Type == "clock-in")
            {
                activeStart = clockEvent;
                labels.Add($"Clock in {occurredAt:HH:mm}");
            }
            else if (clockEvent.Type == "resume-work")
            {
                if (breakStart is not null)
                {
                    breaks += occurredAt - DateTimeOffset.Parse(
                        breakStart.OccurredAt,
                        CultureInfo.InvariantCulture,
                        DateTimeStyles.AssumeUniversal);
                }

                activeStart = clockEvent;
                breakStart = null;
                labels.Add($"Resume work {occurredAt:HH:mm}");
            }
            else if (clockEvent.Type == "start-break")
            {
                if (activeStart is not null)
                {
                    worked += occurredAt - DateTimeOffset.Parse(
                        activeStart.OccurredAt,
                        CultureInfo.InvariantCulture,
                        DateTimeStyles.AssumeUniversal);
                }

                activeStart = null;
                breakStart = clockEvent;
                labels.Add($"Start break {occurredAt:HH:mm}");
            }
            else if (clockEvent.Type == "clock-out")
            {
                if (activeStart is not null)
                {
                    worked += occurredAt - DateTimeOffset.Parse(
                        activeStart.OccurredAt,
                        CultureInfo.InvariantCulture,
                        DateTimeStyles.AssumeUniversal);
                }

                if (breakStart is not null)
                {
                    breaks += occurredAt - DateTimeOffset.Parse(
                        breakStart.OccurredAt,
                        CultureInfo.InvariantCulture,
                        DateTimeStyles.AssumeUniversal);
                }

                activeStart = null;
                breakStart = null;
                labels.Add($"Clock out {occurredAt:HH:mm}");
            }
        }

        return new ClockProjection(ToHours(worked), ToHours(breaks), string.Join(" · ", labels));
    }

    private static RequestDocument? GetApprovedAbsenceForDay(
        string employeeId,
        DateOnly date,
        IReadOnlyList<RequestDocument> requests) =>
        requests.FirstOrDefault(request =>
            request.EmployeeId == employeeId
            && request.Kind == "absence"
            && request.Status == "approved"
            && TryReadDate(request.FromDate, out DateOnly from)
            && TryReadDate(request.ToDate, out DateOnly to)
            && from <= date
            && to >= date);

    private static decimal GetTargetHoursForDate(AttendancePolicyDocument policy, DateOnly date)
    {
        int weekday = (int)date.DayOfWeek;
        int isoWeekday = weekday == 0 ? 7 : weekday;

        return policy.DefaultWorkdays.Contains(isoWeekday)
            ? Math.Round(policy.DefaultWeeklyHours / policy.DefaultWorkdays.Count, 2)
            : 0;
    }

    /// <summary>
    /// Minimum break the shift must contain, from the tenant's configured policy.
    /// </summary>
    /// <remarks>
    /// ArbZG § 4 requires a break for work of <em>more than</em> six hours, so the thresholds
    /// are exclusive. Falls back to the statute when no policy is stored.
    /// </remarks>
    private static decimal GetBreakRequiredHours(
        decimal workedHours,
        IReadOnlyList<BreakPolicyDocument>? legalBreaks)
    {
        IReadOnlyList<BreakPolicyDocument> policies =
            legalBreaks is { Count: > 0 } configured
                ? configured
                : StatutoryBreakPolicy;

        return policies
            .Where(policy => workedHours > policy.AfterHours)
            .Select(policy => policy.MinimumMinutes / 60m)
            .DefaultIfEmpty(0m)
            .Max();
    }

    private static decimal CountBusinessDays(string fromDate, string toDate)
    {
        if (!TryReadDate(fromDate, out DateOnly from) || !TryReadDate(toDate, out DateOnly to) || to < from)
        {
            return 0;
        }

        decimal count = 0;
        for (DateOnly date = from; date <= to; date = date.AddDays(1))
        {
            if (date.DayOfWeek is not DayOfWeek.Saturday and not DayOfWeek.Sunday)
            {
                count++;
            }
        }

        return count;
    }

    private static string? GetHolidayName(string isoDate, AttendancePolicyDocument policy)
    {
        CompanyHolidayDocument? companyHoliday = policy.CompanyHolidays.FirstOrDefault(item => item.Date == isoDate);
        if (companyHoliday is not null)
        {
            return companyHoliday.Name;
        }

        return TryReadDate(isoDate, out DateOnly date)
            ? GermanPublicHolidays.GetHolidayName(date, policy.RegionCode)
            : null;
    }

    private static AttendancePolicyDocument ParsePolicy(JsonElement? policy)
    {
        if (policy is JsonElement element)
        {
            AttendancePolicyDocument? parsed = TryDeserialize<AttendancePolicyDocument>(element);
            if (parsed is not null)
            {
                return parsed with
                {
                    CompanyHolidays = parsed.CompanyHolidays ?? [],
                    DefaultWorkdays = parsed.DefaultWorkdays.Count == 0 ? [1, 2, 3, 4, 5] : parsed.DefaultWorkdays,
                };
            }
        }

        return new AttendancePolicyDocument(40, [1, 2, 3, 4, 5], 30, [], null, null);
    }

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

    private static decimal ToHours(TimeSpan duration) =>
        Math.Round((decimal)duration.TotalHours, 2);

    private static string FullName(ReportEmployeeDto employee) =>
        $"{employee.FirstName} {employee.LastName}".Trim();

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
                "reports.period_month.invalid",
                "Report period must be formatted as yyyy-MM.");
        }

        return normalized;
    }

    private sealed record ClockEventDocument(
        string Id,
        string EmployeeId,
        string Type,
        string OccurredAt,
        string? Location);

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

    private sealed record AttendancePolicyDocument(
        decimal DefaultWeeklyHours,
        IReadOnlyList<int> DefaultWorkdays,
        decimal VacationAnnualDays,
        IReadOnlyList<CompanyHolidayDocument> CompanyHolidays,
        // The stored policy has carried these since the client began writing them; the report
        // simply never read them, so a tenant's federal state and break rules had no effect on
        // the payroll export.
        string? RegionCode = null,
        IReadOnlyList<BreakPolicyDocument>? LegalBreaks = null);

    private sealed record CompanyHolidayDocument(string Date, string Name, bool Paid);

    private sealed record BreakPolicyDocument(decimal AfterHours, decimal MinimumMinutes);

    private sealed record ClockProjection(decimal WorkedHours, decimal BreakHours, string Label);
}
