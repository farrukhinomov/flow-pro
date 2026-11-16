using System.Text.Json;
using FlowPro.Application.Common;

namespace FlowPro.Application.Reports;

public sealed record GetReportsPackageQuery(string PeriodMonth) : IQuery<ReportsPackageDto>;

public sealed record ReportsPackageDto(
    string PeriodMonth,
    DateTimeOffset GeneratedAt,
    IReadOnlyList<EmployeePayrollReportDto> EmployeeReports,
    IReadOnlyList<AbsenceBalanceReportDto> AbsenceBalances,
    IReadOnlyList<TeamReportDto> TeamReports);

public sealed record EmployeePayrollReportDto(
    ReportEmployeeDto Employee,
    MonthlyReportApprovalDto? Approval,
    IReadOnlyList<PayrollReportDayDto> Days,
    PayrollReportTotalsDto Totals);

public sealed record ReportEmployeeDto(
    string Id,
    string FirstName,
    string LastName,
    string Username,
    string Email,
    string PhoneNumber,
    string Status,
    string Role,
    string? RoleProfileId,
    string Team,
    string Manager,
    string WorkPattern,
    string VisibilityScope,
    DateTimeOffset? LastSeenAt,
    DateTimeOffset? NextReviewAt,
    DateTimeOffset? DeactivatedAt,
    string? DeactivatedBy,
    string? DeactivationReason,
    DateTimeOffset? RetentionUntil,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record MonthlyReportApprovalDto(
    string Id,
    string EmployeeId,
    string PeriodMonth,
    string Status,
    string? SignedById,
    string? SignedByName,
    DateTimeOffset? SignedAt,
    string? Note,
    DateTimeOffset? PayrollExportedAt,
    DateTimeOffset? PdfExportedAt,
    DateTimeOffset UpdatedAt);

public sealed record PayrollReportDayDto(
    string Date,
    string EmployeeId,
    string EmployeeName,
    string Status,
    decimal WorkedHours,
    decimal PaidHours,
    decimal TargetHours,
    decimal FlexHours,
    decimal BreakHours,
    decimal BreakRequiredHours,
    bool BreakCompliant);

public sealed record PayrollReportTotalsDto(
    decimal WorkedHours,
    decimal PaidHours,
    decimal TargetHours,
    decimal FlexHours,
    decimal BreakHours,
    int ComplianceIssues);

public sealed record AbsenceBalanceReportDto(
    string EmployeeId,
    string EmployeeName,
    decimal AnnualVacationDays,
    decimal ApprovedVacationDays,
    decimal PlannedVacationDays,
    decimal RemainingVacationDays,
    decimal SicknessDays,
    decimal HomeOfficeDays);

public sealed record TeamReportDto(
    string Team,
    int Headcount,
    int SignedPeriods,
    int OpenPeriods,
    decimal WorkedHours,
    decimal TargetHours,
    decimal FlexHours,
    int ComplianceIssues,
    decimal ApprovedAbsenceDays);

public sealed record ReportWorkflowSnapshot(
    IReadOnlyList<ReportEmployeeDto> Employees,
    IReadOnlyList<JsonElement> ClockEvents,
    IReadOnlyList<JsonElement> Requests,
    IReadOnlyList<MonthlyReportApprovalDto> Approvals,
    JsonElement? Policy);
