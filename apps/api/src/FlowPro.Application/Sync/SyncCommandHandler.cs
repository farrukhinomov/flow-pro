using System.Text.Json;
using FlowPro.Application.Audit;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Integration;
using FlowPro.Domain.Audit;
using FlowPro.Domain.Integration;
using FlowPro.Domain.Sync;

namespace FlowPro.Application.Sync;

public sealed class SyncCommandHandler(
    ICurrentRequestContext requestContext,
    IPermissionChecker permissionChecker,
    ISyncAggregateRepository aggregateRepository,
    IOutboxWriter outboxWriter,
    IAuditWriter auditWriter,
    IUnitOfWork unitOfWork,
    TimeProvider timeProvider) : ICommandHandler<SubmitSyncBatchCommand, SyncBatchResponse>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly HashSet<string> AllowedAggregates =
    [
        "absence",
        "approval-workflow",
        "attachment",
        "attendance-policy",
        "attendance-type",
        "notification",
        "notification-preferences",
        "organization-catalog",
        "payroll-export",
        "request",
        "timesheet",
        "user",
    ];
    private static readonly HashSet<string> TenantWideAggregates =
    [
        "attendance-policy",
        "attendance-type",
        "organization-catalog",
    ];

    public async Task<SyncBatchResponse> HandleAsync(
        SubmitSyncBatchCommand command,
        CancellationToken cancellationToken)
    {
        Validate(command);
        RequestIdentity identity = requestContext.GetRequiredIdentity();

        return await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                DateTimeOffset now = timeProvider.GetUtcNow();
                List<SyncAcceptedOperation> accepted = [];
                List<SyncConflict> conflicts = [];
                List<SyncRejectedOperation> rejected = [];

                foreach (ClientSyncOperation operation in command.Operations)
                {
                    if (!AllowedAggregates.Contains(operation.Aggregate))
                    {
                        rejected.Add(
                            new SyncRejectedOperation(
                                operation.Id,
                                $"Aggregate '{operation.Aggregate}' is not syncable.",
                                Retryable: false));
                        continue;
                    }

                    if (!OperationMatchesAggregate(operation))
                    {
                        rejected.Add(
                            new SyncRejectedOperation(
                                operation.Id,
                                $"Operation '{operation.Type}' does not match aggregate '{operation.Aggregate}'.",
                                Retryable: false));
                        continue;
                    }

                    if (!IsSupportedConflictResolution(operation.Conflict))
                    {
                        rejected.Add(
                            new SyncRejectedOperation(
                                operation.Id,
                                $"Conflict resolution '{operation.Conflict?.Resolution}' is not supported.",
                                Retryable: false));
                        continue;
                    }

                    ClientAggregate? current = await aggregateRepository.FindAsync(
                        identity.TenantId,
                        operation.Aggregate,
                        operation.AggregateId,
                        transactionCancellationToken);
                    OperationPermissionDecision permission = await AuthorizeOperationAsync(
                        identity,
                        operation,
                        current,
                        transactionCancellationToken);
                    if (!permission.Granted)
                    {
                        rejected.Add(
                            new SyncRejectedOperation(
                                operation.Id,
                                permission.Message,
                                Retryable: false));
                        continue;
                    }

                    bool isDelete = operation.Type.EndsWith(".delete", StringComparison.OrdinalIgnoreCase);
                    bool localWins = operation.Conflict?.Resolution == "local-wins";
                    Guid? ownerUserId = ResolveOwnerUserId(identity, current, operation);

                    if (current is not null
                        && current.LastClientOperationId == operation.Id)
                    {
                        accepted.Add(
                            new SyncAcceptedOperation(
                                operation.Id,
                                current.ServerVersion,
                                current.UpdatedAt));
                        continue;
                    }

                    if (current is not null
                        && current.ClientUpdatedAt > operation.ClientCreatedAt
                        && !localWins)
                    {
                        conflicts.Add(
                            new SyncConflict(
                                operation.Id,
                                operation.Aggregate,
                                operation.AggregateId,
                                "Server has a newer version of this record.",
                                current.ServerVersion,
                                JsonSerializer.Deserialize<JsonElement>(current.PayloadJson)));
                        continue;
                    }

                    if (current is null)
                    {
                        current = new ClientAggregate(
                            identity.TenantId,
                            operation.Aggregate,
                            operation.AggregateId,
                            operation.Payload.GetRawText(),
                            operation.Id,
                            operation.ClientCreatedAt,
                            ownerUserId);
                        if (isDelete)
                        {
                            current.Delete(operation.Id, operation.ClientCreatedAt);
                        }

                        aggregateRepository.Add(current);
                    }
                    else if (isDelete)
                    {
                        current.Delete(operation.Id, operation.ClientCreatedAt);
                    }
                    else
                    {
                        current.Upsert(
                            operation.Payload.GetRawText(),
                            operation.Id,
                            operation.ClientCreatedAt);
                    }

                    string payload = JsonSerializer.Serialize(
                        new ClientAggregateSyncEvent(
                            operation.Aggregate,
                            operation.AggregateId,
                            operation.Type,
                            isDelete,
                            JsonSerializer.Deserialize<JsonElement>(current.PayloadJson),
                            operation.Id,
                            command.ClientId,
                            current.ServerVersion,
                            now,
                            current.OwnerUserId),
                        JsonOptions);

                    outboxWriter.Add(
                        new OutboxMessage(
                            identity.TenantId,
                            isDelete ? "client-aggregate.deleted.v1" : "client-aggregate.upserted.v1",
                            operation.Aggregate,
                            ClientAggregateIds.Stable(operation.Aggregate, operation.AggregateId),
                            payload,
                            now));

                    auditWriter.Add(
                        new AuditEvent(
                            identity.TenantId,
                            identity.UserId,
                            operation.Type,
                            operation.Aggregate,
                            ClientAggregateIds.Stable(operation.Aggregate, operation.AggregateId),
                            BuildAuditDetailsJson(
                                command,
                                operation,
                                current,
                                isDelete,
                                localWins),
                            now));

                    accepted.Add(new SyncAcceptedOperation(operation.Id, current.ServerVersion, now));
                }

                return new SyncBatchResponse(accepted, conflicts, rejected, now);
            },
            cancellationToken);
    }

    private static string BuildAuditDetailsJson(
        SubmitSyncBatchCommand command,
        ClientSyncOperation operation,
        ClientAggregate aggregate,
        bool isDelete,
        bool localWins) =>
        JsonSerializer.Serialize(
            new
            {
                operationId = operation.Id,
                operation.Type,
                operation.Aggregate,
                operation.AggregateId,
                command.ClientId,
                command.Protocol,
                command.SchemaVersion,
                operation.ClientCreatedAt,
                aggregate.ServerVersion,
                aggregate.OwnerUserId,
                deleted = isDelete,
                conflictResolution = localWins ? "local-wins" : "server-wins-or-not-needed",
            },
            JsonOptions);

    private async Task<OperationPermissionDecision> AuthorizeOperationAsync(
        RequestIdentity identity,
        ClientSyncOperation operation,
        ClientAggregate? current,
        CancellationToken cancellationToken)
    {
        if (operation.Type is "notification.upsert" or "notification.delete" or "notification.mark-read")
        {
            return await AuthorizeOwnedOrManagedOperationAsync(
                identity,
                operation,
                current,
                PermissionKeys.NotificationsWriteSelf,
                PermissionKeys.NotificationsManage,
                "recipientUserId",
                "ownerUserId",
                cancellationToken);
        }

        if (operation.Type == "notification-preferences.upsert")
        {
            return await AuthorizeOwnedOrManagedOperationAsync(
                identity,
                operation,
                current,
                PermissionKeys.NotificationsWriteSelf,
                PermissionKeys.NotificationsManage,
                "ownerUserId",
                cancellationToken);
        }

        string? requiredPermission = GetRequiredPermission(operation);
        if (requiredPermission is null)
        {
            return new OperationPermissionDecision(
                false,
                $"Operation '{operation.Type}' is not supported for aggregate '{operation.Aggregate}'.");
        }

        bool granted = await permissionChecker.HasPermissionAsync(
            identity.TenantId,
            identity.UserId,
            requiredPermission,
            cancellationToken);

        return granted
            ? OperationPermissionDecision.Allow
            : new OperationPermissionDecision(false, $"Permission '{requiredPermission}' is required.");
    }

    private async Task<OperationPermissionDecision> AuthorizeOwnedOrManagedOperationAsync(
        RequestIdentity identity,
        ClientSyncOperation operation,
        ClientAggregate? current,
        string selfPermission,
        string managePermission,
        string ownerProperty,
        CancellationToken cancellationToken) =>
        await AuthorizeOwnedOrManagedOperationAsync(
            identity,
            operation,
            current,
            selfPermission,
            managePermission,
            [ownerProperty],
            cancellationToken);

    private async Task<OperationPermissionDecision> AuthorizeOwnedOrManagedOperationAsync(
        RequestIdentity identity,
        ClientSyncOperation operation,
        ClientAggregate? current,
        string selfPermission,
        string managePermission,
        string ownerProperty,
        string alternateOwnerProperty,
        CancellationToken cancellationToken) =>
        await AuthorizeOwnedOrManagedOperationAsync(
            identity,
            operation,
            current,
            selfPermission,
            managePermission,
            [ownerProperty, alternateOwnerProperty],
            cancellationToken);

    private async Task<OperationPermissionDecision> AuthorizeOwnedOrManagedOperationAsync(
        RequestIdentity identity,
        ClientSyncOperation operation,
        ClientAggregate? current,
        string selfPermission,
        string managePermission,
        string[] ownerProperties,
        CancellationToken cancellationToken)
    {
        Guid? ownerUserId = current?.OwnerUserId ?? TryReadGuidProperty(operation.Payload, ownerProperties);
        if (ownerUserId == identity.UserId
            && await permissionChecker.HasPermissionAsync(
                identity.TenantId,
                identity.UserId,
                selfPermission,
                cancellationToken))
        {
            return OperationPermissionDecision.Allow;
        }

        if (await permissionChecker.HasPermissionAsync(
                identity.TenantId,
                identity.UserId,
                managePermission,
                cancellationToken))
        {
            return OperationPermissionDecision.Allow;
        }

        return new OperationPermissionDecision(
            false,
            $"Permission '{selfPermission}' for own records or '{managePermission}' is required.");
    }

    private static string? GetRequiredPermission(ClientSyncOperation operation) =>
        operation.Type switch
        {
            "absence.upsert" or "absence.delete" => PermissionKeys.AbsencesWriteSelf,
            "approval-workflow.upsert" or "approval-workflow.delete" => PermissionKeys.ApprovalWorkflowsManage,
            "attachment.upsert" or "attachment.delete" => PermissionKeys.AttachmentsWriteSelf,
            "attendance-policy.upsert" => PermissionKeys.AttendancePolicyManage,
            "attendance-type.upsert" or "attendance-type.delete" => PermissionKeys.AttendancePolicyManage,
            "notification.upsert" or "notification.delete" or "notification.mark-read" => PermissionKeys.NotificationsWriteSelf,
            "notification-preferences.upsert" => PermissionKeys.NotificationsWriteSelf,
            "organization-catalog.upsert" => PermissionKeys.OrganizationManage,
            "payroll-export.upsert" or "payroll-export.delete" => PermissionKeys.PayrollExportsManage,
            "request.submit" or "request.upsert" or "request.cancel" => PermissionKeys.RequestsWriteSelf,
            "request.approve" or "request.reject" => PermissionKeys.RequestsApprove,
            "timesheet.sign" => PermissionKeys.TimesheetsManage,
            "timesheet.upsert" => PermissionKeys.TimesheetsWriteSelf,
            "timesheet.export" => PermissionKeys.PayrollExportsManage,
            "user.invite" or "user.upsert" or "user.deactivate" or "user.reactivate" => PermissionKeys.UsersManage,
            _ => null,
        };

    private sealed record OperationPermissionDecision(bool Granted, string Message)
    {
        public static readonly OperationPermissionDecision Allow = new(true, string.Empty);
    }

    private static bool IsSupportedConflictResolution(ClientSyncConflictResolution? conflict)
    {
        if (string.IsNullOrWhiteSpace(conflict?.Resolution))
        {
            return true;
        }

        return conflict.Resolution is "local-wins" or "server-wins";
    }

    private static bool OperationMatchesAggregate(ClientSyncOperation operation)
    {
        int separatorIndex = operation.Type.IndexOf('.', StringComparison.Ordinal);
        string operationAggregate = separatorIndex < 0
            ? operation.Type
            : operation.Type[..separatorIndex];

        return string.Equals(operationAggregate, operation.Aggregate, StringComparison.Ordinal);
    }

    private static Guid? ResolveOwnerUserId(
        RequestIdentity identity,
        ClientAggregate? current,
        ClientSyncOperation operation)
    {
        if (current?.OwnerUserId is not null)
        {
            return current.OwnerUserId;
        }

        if (TenantWideAggregates.Contains(operation.Aggregate))
        {
            return null;
        }

        Guid? payloadOwner = TryReadGuidProperty(
            operation.Payload,
            "ownerUserId",
            "userId",
            "employeeId",
            "recipientUserId",
            "uploadedByUserId");

        return payloadOwner ?? identity.UserId;
    }

    private static Guid? TryReadGuidProperty(JsonElement payload, params string[] propertyNames)
    {
        if (payload.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        foreach (string propertyName in propertyNames)
        {
            if (payload.TryGetProperty(propertyName, out JsonElement property)
                && property.ValueKind == JsonValueKind.String
                && Guid.TryParse(property.GetString(), out Guid parsed))
            {
                return parsed;
            }
        }

        return null;
    }

    private static void Validate(SubmitSyncBatchCommand command)
    {
        if (command.Protocol != "flowpro-sync-v1")
        {
            throw new FlowProValidationException(
                "sync.protocol.invalid",
                "The sync protocol version is not supported.");
        }

        if (string.IsNullOrWhiteSpace(command.ClientId))
        {
            throw new FlowProValidationException(
                "sync.client-id.required",
                "A client id is required.");
        }

        if (command.Operations.Count > 100)
        {
            throw new FlowProValidationException(
                "sync.batch.too-large",
                "A single sync batch cannot contain more than 100 operations.");
        }
    }
}
