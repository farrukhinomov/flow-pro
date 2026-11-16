using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Timesheets;

namespace FlowPro.Api.Timesheets;

internal static class TimesheetWorkflowEndpoints
{
    public static IEndpointRouteBuilder MapTimesheetWorkflowEndpoints(this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder group = endpoints
            .MapGroup("/api/v1/timesheet-workflows")
            .WithTags("Timesheet Workflows");

        group.MapGet(
                "/{employeeId}/{periodMonth}",
                (
                    string employeeId,
                    string periodMonth,
                    IQueryHandler<GetMonthlyTimesheetQuery, MonthlyTimesheetApprovalDto> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new GetMonthlyTimesheetQuery(employeeId, periodMonth),
                        cancellationToken))
            .RequireAuthorization();

        group.MapPost(
                "/{employeeId}/{periodMonth}/sign",
                (
                    string employeeId,
                    string periodMonth,
                    SignTimesheetRequest request,
                    ICommandHandler<SignMonthlyTimesheetCommand, MonthlyTimesheetApprovalDto> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new SignMonthlyTimesheetCommand(
                            employeeId,
                            periodMonth,
                            request.Note,
                            request.Snapshot),
                        cancellationToken))
            .RequireAuthorization(PermissionKeys.TimesheetsManage);

        group.MapPost(
                "/{employeeId}/{periodMonth}/reopen",
                (
                    string employeeId,
                    string periodMonth,
                    ReopenTimesheetRequest request,
                    ICommandHandler<ReopenMonthlyTimesheetCommand, MonthlyTimesheetApprovalDto> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new ReopenMonthlyTimesheetCommand(employeeId, periodMonth, request.Reason),
                        cancellationToken))
            .RequireAuthorization(PermissionKeys.TimesheetsManage);

        group.MapPost(
                "/{employeeId}/{periodMonth}/exports/{kind}",
                (
                    string employeeId,
                    string periodMonth,
                    string kind,
                    ICommandHandler<MarkTimesheetExportedCommand, MonthlyTimesheetApprovalDto> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new MarkTimesheetExportedCommand(employeeId, periodMonth, kind),
                        cancellationToken))
            .RequireAuthorization(PermissionKeys.PayrollExportsManage);

        return endpoints;
    }

    private sealed record SignTimesheetRequest(
        string? Note,
        TimesheetSnapshotDto? Snapshot);

    private sealed record ReopenTimesheetRequest(string? Reason);
}
