using System.Text.Json;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Sync;
using Microsoft.AspNetCore.Mvc;

namespace FlowPro.Api.Modules;

internal static class ModuleAggregateEndpoints
{
    private static readonly JsonElement DeletePayload =
        JsonSerializer.SerializeToElement(new { deleted = true });

    private static readonly IReadOnlyList<ModuleAggregateRoute> Routes =
    [
        new("Absences", "/api/v1/absences", "absence", "absence.upsert", "absence.delete", PermissionKeys.SyncReadSelf, PermissionKeys.AbsencesWriteSelf, true),
        new("Approval Workflows", "/api/v1/approval-workflows", "approval-workflow", "approval-workflow.upsert", "approval-workflow.delete", PermissionKeys.ApprovalWorkflowsManage, PermissionKeys.ApprovalWorkflowsManage, false),
        new("Approvals", "/api/v1/approvals", "request", "request.approve", "request.reject", PermissionKeys.RequestsApprove, PermissionKeys.RequestsApprove, false),
        new("Attachments", "/api/v1/attachments", "attachment", "attachment.upsert", "attachment.delete", PermissionKeys.SyncReadSelf, PermissionKeys.AttachmentsWriteSelf, true),
        new("Manager Timesheets", "/api/v1/manager-timesheets", "timesheet", "timesheet.sign", "timesheet.export", PermissionKeys.TimesheetsManage, PermissionKeys.TimesheetsManage, false),
        new("Notifications", "/api/v1/notifications", "notification", "notification.upsert", "notification.delete", PermissionKeys.SyncReadSelf, PermissionKeys.NotificationsManage, true),
        new("Payroll Exports", "/api/v1/payroll/exports", "payroll-export", "payroll-export.upsert", "payroll-export.delete", PermissionKeys.PayrollExportsManage, PermissionKeys.PayrollExportsManage, false),
        new("Requests", "/api/v1/requests", "request", "request.upsert", "request.cancel", PermissionKeys.SyncReadSelf, PermissionKeys.RequestsWriteSelf, true),
        new("Timesheets", "/api/v1/timesheets", "timesheet", "timesheet.upsert", "timesheet.export", PermissionKeys.SyncReadSelf, PermissionKeys.TimesheetsWriteSelf, true),
        new("Users", "/api/v1/users", "user", "user.upsert", "user.deactivate", PermissionKeys.UsersManage, PermissionKeys.UsersManage, false),
    ];

    public static IEndpointRouteBuilder MapModuleAggregateEndpoints(this IEndpointRouteBuilder endpoints)
    {
        foreach (ModuleAggregateRoute route in Routes)
        {
            ModuleAggregateRoute currentRoute = route;
            RouteGroupBuilder group = endpoints.MapGroup(currentRoute.Pattern).WithTags(currentRoute.Tag);

            group.MapGet(
                    "",
                    (
                        string? cursor,
                        int? limit,
                        bool? includeDeleted,
                        IQueryHandler<ListClientAggregatesQuery, ClientAggregatePage> handler,
                        CancellationToken cancellationToken) =>
                        handler.HandleAsync(
                            new ListClientAggregatesQuery(
                                currentRoute.Aggregate,
                                limit is null && string.IsNullOrWhiteSpace(cursor)
                                    ? null
                                    : new CursorPageRequest(cursor, limit ?? CursorPageRequest.DefaultLimit),
                                includeDeleted ?? false,
                                currentRoute.OwnerOnly),
                            cancellationToken))
                .RequireAuthorization(currentRoute.ReadPermission);

            group.MapPut(
                    "/{aggregateId}",
                    (
                        string aggregateId,
                        [FromBody]
                        ModuleAggregateMutationRequest request,
                        HttpContext httpContext,
                        ICommandHandler<SubmitSyncBatchCommand, SyncBatchResponse> handler,
                        TimeProvider timeProvider,
                        CancellationToken cancellationToken) =>
                        UpsertAsync(
                            currentRoute,
                            aggregateId,
                            request,
                            httpContext,
                            handler,
                            timeProvider,
                            cancellationToken))
                .RequireAuthorization(currentRoute.WritePermission);

            group.MapDelete(
                    "/{aggregateId}",
                    (
                        string aggregateId,
                        string? clientId,
                        string? clientOperationId,
                        DateTimeOffset? clientCreatedAt,
                        string? conflictResolution,
                        HttpContext httpContext,
                        ICommandHandler<SubmitSyncBatchCommand, SyncBatchResponse> handler,
                        TimeProvider timeProvider,
                        CancellationToken cancellationToken) =>
                        DeleteAsync(
                            currentRoute,
                            aggregateId,
                            new ModuleAggregateDeleteRequest(
                                clientId,
                                clientOperationId,
                                clientCreatedAt,
                                string.IsNullOrWhiteSpace(conflictResolution)
                                    ? null
                                    : new ClientSyncConflictResolution(conflictResolution)),
                            httpContext,
                            handler,
                            timeProvider,
                            cancellationToken))
                .RequireAuthorization(currentRoute.WritePermission);
        }

        return endpoints;
    }

    private static async Task<IResult> UpsertAsync(
        ModuleAggregateRoute route,
        string aggregateId,
        ModuleAggregateMutationRequest request,
        HttpContext httpContext,
        ICommandHandler<SubmitSyncBatchCommand, SyncBatchResponse> handler,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(aggregateId)
            || request.Payload.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
        {
            return Results.ValidationProblem(
                new Dictionary<string, string[]>
                {
                    ["payload"] = ["A non-empty aggregate id and payload are required."],
                });
        }

        SyncBatchResponse response = await handler.HandleAsync(
            BuildCommand(
                route,
                aggregateId,
                route.UpsertOperationType,
                request.Payload,
                request.ClientId,
                request.ClientOperationId,
                request.ClientCreatedAt,
                request.Conflict,
                httpContext,
                timeProvider),
            cancellationToken);

        return Results.Ok(response);
    }

    private static async Task<IResult> DeleteAsync(
        ModuleAggregateRoute route,
        string aggregateId,
        ModuleAggregateDeleteRequest? request,
        HttpContext httpContext,
        ICommandHandler<SubmitSyncBatchCommand, SyncBatchResponse> handler,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(aggregateId))
        {
            return Results.ValidationProblem(
                new Dictionary<string, string[]>
                {
                    ["aggregateId"] = ["A non-empty aggregate id is required."],
                });
        }

        SyncBatchResponse response = await handler.HandleAsync(
            BuildCommand(
                route,
                aggregateId,
                route.DeleteOperationType,
                DeletePayload,
                request?.ClientId,
                request?.ClientOperationId,
                request?.ClientCreatedAt,
                request?.Conflict,
                httpContext,
                timeProvider),
            cancellationToken);

        return Results.Ok(response);
    }

    private static SubmitSyncBatchCommand BuildCommand(
        ModuleAggregateRoute route,
        string aggregateId,
        string operationType,
        JsonElement payload,
        string? clientId,
        string? clientOperationId,
        DateTimeOffset? clientCreatedAt,
        ClientSyncConflictResolution? conflict,
        HttpContext httpContext,
        TimeProvider timeProvider)
    {
        string resolvedClientId = ResolveClientId(clientId, httpContext);
        string resolvedOperationId = string.IsNullOrWhiteSpace(clientOperationId)
            ? $"api-{Guid.CreateVersion7():N}"
            : clientOperationId.Trim();

        return new SubmitSyncBatchCommand(
            "flowpro-sync-v1",
            resolvedClientId,
            1,
            [
                new ClientSyncOperation(
                    resolvedOperationId,
                    operationType,
                    route.Aggregate,
                    aggregateId.Trim(),
                    payload,
                    clientCreatedAt ?? timeProvider.GetUtcNow(),
                    conflict),
            ]);
    }

    private static string ResolveClientId(string? clientId, HttpContext httpContext)
    {
        if (!string.IsNullOrWhiteSpace(clientId))
        {
            return clientId.Trim();
        }

        string headerClientId = httpContext.Request.Headers["X-FlowPro-Client-Id"].ToString();
        return string.IsNullOrWhiteSpace(headerClientId) ? "flowpro-api" : headerClientId;
    }

    private sealed record ModuleAggregateRoute(
        string Tag,
        string Pattern,
        string Aggregate,
        string UpsertOperationType,
        string DeleteOperationType,
        string ReadPermission,
        string WritePermission,
        bool OwnerOnly);

    private sealed record ModuleAggregateMutationRequest(
        string? ClientId,
        string? ClientOperationId,
        JsonElement Payload,
        DateTimeOffset? ClientCreatedAt,
        ClientSyncConflictResolution? Conflict);

    private sealed record ModuleAggregateDeleteRequest(
        string? ClientId,
        string? ClientOperationId,
        DateTimeOffset? ClientCreatedAt,
        ClientSyncConflictResolution? Conflict);
}
