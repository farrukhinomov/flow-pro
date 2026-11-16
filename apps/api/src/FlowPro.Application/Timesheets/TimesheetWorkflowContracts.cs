using System.Text.Json;
using FlowPro.Application.Common;

namespace FlowPro.Application.Timesheets;

public sealed record GetMonthlyTimesheetQuery(
    string EmployeeId,
    string PeriodMonth) : IQuery<MonthlyTimesheetApprovalDto>;

public sealed record SignMonthlyTimesheetCommand(
    string EmployeeId,
    string PeriodMonth,
    string? Note,
    TimesheetSnapshotDto? Snapshot) : ICommand<MonthlyTimesheetApprovalDto>;

public sealed record ReopenMonthlyTimesheetCommand(
    string EmployeeId,
    string PeriodMonth,
    string? Reason) : ICommand<MonthlyTimesheetApprovalDto>;

public sealed record MarkTimesheetExportedCommand(
    string EmployeeId,
    string PeriodMonth,
    string Kind) : ICommand<MonthlyTimesheetApprovalDto>;

public sealed record MonthlyTimesheetApprovalDto(
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

public sealed record TimesheetSnapshotDto(
    JsonElement? Totals,
    JsonElement? Rows);
