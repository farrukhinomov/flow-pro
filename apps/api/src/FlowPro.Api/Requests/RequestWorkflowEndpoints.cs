using System.Text.Json;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Requests;
using FlowPro.Application.Sync;

namespace FlowPro.Api.Requests;

internal static class RequestWorkflowEndpoints
{
    public static IEndpointRouteBuilder MapRequestWorkflowEndpoints(this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder requests = endpoints.MapGroup("/api/v1/request-workflows").WithTags("Request Workflows");

        requests.MapGet(
                "",
                (
                    string? cursor,
                    int? limit,
                    bool? includeDeleted,
                    IQueryHandler<ListClientAggregatesQuery, ClientAggregatePage> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new ListClientAggregatesQuery(
                            "request",
                            ToPage(cursor, limit),
                            includeDeleted ?? false,
                            true),
                        cancellationToken))
            .RequireAuthorization(PermissionKeys.SyncReadSelf);

        requests.MapGet(
                "/approval-inbox",
                (
                    string? cursor,
                    int? limit,
                    bool? includeDeleted,
                    IQueryHandler<ListClientAggregatesQuery, ClientAggregatePage> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new ListClientAggregatesQuery(
                            "request",
                            ToPage(cursor, limit),
                            includeDeleted ?? false,
                            false),
                        cancellationToken))
            .RequireAuthorization(PermissionKeys.RequestsApprove);

        requests.MapPost(
                "",
                (
                    SubmitRequestHttpRequest request,
                    ICommandHandler<SubmitRequestCommand, RequestWorkflowResult> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(request.ToCommand(), cancellationToken))
            .RequireAuthorization(PermissionKeys.RequestsWriteSelf);

        requests.MapPost(
                "/{requestId}/decision",
                (
                    string requestId,
                    DecideRequestHttpRequest request,
                    ICommandHandler<DecideRequestCommand, RequestWorkflowResult> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(request.ToCommand(requestId), cancellationToken))
            .RequireAuthorization(PermissionKeys.RequestsApprove);

        requests.MapPost(
                "/{requestId}/cancel",
                (
                    string requestId,
                    CancelRequestHttpRequest request,
                    ICommandHandler<CancelRequestCommand, RequestWorkflowResult> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(request.ToCommand(requestId), cancellationToken))
            .RequireAuthorization(PermissionKeys.RequestsWriteSelf);

        requests.MapPost(
                "/{requestId}/adjust-and-approve",
                (
                    string requestId,
                    AdjustAndApproveRequestHttpRequest request,
                    ICommandHandler<AdjustAndApproveRequestCommand, RequestWorkflowResult> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(request.ToCommand(requestId), cancellationToken))
            .RequireAuthorization(PermissionKeys.RequestsApprove);

        endpoints.MapGet(
                "/api/v1/absence-workflows",
                (
                    string? cursor,
                    int? limit,
                    bool? includeDeleted,
                    IQueryHandler<ListClientAggregatesQuery, ClientAggregatePage> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new ListClientAggregatesQuery(
                            "absence",
                            ToPage(cursor, limit),
                            includeDeleted ?? false,
                            true),
                        cancellationToken))
            .WithTags("Absence Workflows")
            .RequireAuthorization(PermissionKeys.SyncReadSelf);

        endpoints.MapGet(
                "/api/v1/absence-workflows/manager",
                (
                    string? cursor,
                    int? limit,
                    bool? includeDeleted,
                    IQueryHandler<ListClientAggregatesQuery, ClientAggregatePage> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new ListClientAggregatesQuery(
                            "absence",
                            ToPage(cursor, limit),
                            includeDeleted ?? false,
                            false),
                        cancellationToken))
            .WithTags("Absence Workflows")
            .RequireAuthorization(PermissionKeys.RequestsApprove);

        endpoints.MapGet(
                "/api/v1/notification-workflows",
                (
                    string? cursor,
                    int? limit,
                    bool? includeDeleted,
                    IQueryHandler<ListClientAggregatesQuery, ClientAggregatePage> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new ListClientAggregatesQuery(
                            "notification",
                            ToPage(cursor, limit),
                            includeDeleted ?? false,
                            true),
                        cancellationToken))
            .WithTags("Notification Workflows")
            .RequireAuthorization(PermissionKeys.SyncReadSelf);

        endpoints.MapGet(
                "/api/v1/payroll/workflows/exports",
                (
                    string? cursor,
                    int? limit,
                    bool? includeDeleted,
                    IQueryHandler<ListClientAggregatesQuery, ClientAggregatePage> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new ListClientAggregatesQuery(
                            "payroll-export",
                            ToPage(cursor, limit),
                            includeDeleted ?? false,
                            false),
                        cancellationToken))
            .WithTags("Payroll Workflows")
            .RequireAuthorization(PermissionKeys.PayrollExportsManage);

        endpoints.MapPost(
                "/api/v1/payroll/workflows/exports",
                (
                    CreatePayrollExportHttpRequest request,
                    ICommandHandler<CreatePayrollExportCommand, RequestWorkflowResult> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(request.ToCommand(), cancellationToken))
            .WithTags("Payroll Workflows")
            .RequireAuthorization(PermissionKeys.PayrollExportsManage);

        return endpoints;
    }

    private static CursorPageRequest? ToPage(string? cursor, int? limit) =>
        limit is null && string.IsNullOrWhiteSpace(cursor)
            ? null
            : new CursorPageRequest(cursor, limit ?? CursorPageRequest.DefaultLimit);
}

internal sealed record SubmitRequestHttpRequest(
    string? RequestId,
    string Kind,
    Guid EmployeeId,
    string EmployeeName,
    DateOnly FromDate,
    DateOnly ToDate,
    string Subtype,
    string? StatusTypeId,
    string? StatusCode,
    string? StatusLabel,
    string? ClockIn,
    string? ClockOut,
    JsonElement? ProposedEvents,
    RequestPartialDay? PartialDay,
    RequestRecurrence? Recurrence,
    IReadOnlyList<RequestAttachment>? Attachments,
    string? Reason,
    RequestApprovalFlow? ApprovalFlow,
    string? ClientId,
    string? ClientOperationId)
{
    public SubmitRequestCommand ToCommand() =>
        new(
            RequestId,
            Kind,
            EmployeeId,
            EmployeeName,
            FromDate,
            ToDate,
            Subtype,
            StatusTypeId,
            StatusCode,
            StatusLabel,
            ClockIn,
            ClockOut,
            ProposedEvents,
            PartialDay,
            Recurrence,
            Attachments ?? [],
            Reason,
            ApprovalFlow,
            ClientId,
            ClientOperationId);
}

internal sealed record DecideRequestHttpRequest(
    RequestDecision Decision,
    string? Comment,
    string? ClientId,
    string? ClientOperationId)
{
    public DecideRequestCommand ToCommand(string requestId) =>
        new(requestId, Decision, Comment, ClientId, ClientOperationId);
}

internal sealed record CancelRequestHttpRequest(string? ClientId, string? ClientOperationId)
{
    public CancelRequestCommand ToCommand(string requestId) =>
        new(requestId, ClientId, ClientOperationId);
}

internal sealed record AdjustAndApproveRequestHttpRequest(
    SubmitRequestHttpRequest AdjustedRequest,
    string? Comment,
    string? ClientId,
    string? ClientOperationId)
{
    public AdjustAndApproveRequestCommand ToCommand(string requestId) =>
        new(
            requestId,
            AdjustedRequest.ToCommand(),
            Comment,
            ClientId,
            ClientOperationId);
}

internal sealed record CreatePayrollExportHttpRequest(
    string Period,
    string Format,
    string? Scope,
    string? ClientId,
    string? ClientOperationId)
{
    public CreatePayrollExportCommand ToCommand() =>
        new(Period, Format, Scope, ClientId, ClientOperationId);
}
