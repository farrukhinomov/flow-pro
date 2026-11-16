using System.Text.Json;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Integration;
using FlowPro.Domain.Integration;

namespace FlowPro.Application.Sync;

public sealed class SyncQueryHandler(
    ICurrentRequestContext requestContext,
    IOutboxReader outboxReader,
    IPermissionChecker permissionChecker,
    ISyncAggregateRepository aggregateRepository) :
    IQueryHandler<ListSyncChangesQuery, SyncPage>,
    IQueryHandler<ListClientAggregatesQuery, ClientAggregatePage>
{
    public async Task<SyncPage> HandleAsync(
        ListSyncChangesQuery query,
        CancellationToken cancellationToken)
    {
        if (query.AfterSequence < 0)
        {
            throw new FlowProValidationException("sync.cursor.invalid", "Sync cursor cannot be negative.");
        }

        int pageSize = Math.Clamp(query.Limit, 1, 200);
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        IReadOnlyList<OutboxMessage> messages = await outboxReader.ListChangesAsync(
            identity.TenantId,
            query.AfterSequence,
            pageSize,
            cancellationToken);

        Dictionary<string, bool> permissionCache = [];
        List<SyncChange> changes = [];

        foreach (OutboxMessage message in messages)
        {
            JsonElement payload = JsonSerializer.Deserialize<JsonElement>(message.PayloadJson);
            if (!await CanReadMessageAsync(identity, message, payload, permissionCache, cancellationToken))
            {
                continue;
            }

            changes.Add(
                new SyncChange(
                    message.Sequence,
                    message.EventType,
                    message.AggregateType,
                    message.AggregateId,
                    payload,
                    message.OccurredAt));
        }

        long nextCursor = messages.Count == 0 ? query.AfterSequence : messages[^1].Sequence;
        return new SyncPage(changes, nextCursor);
    }

    public async Task<ClientAggregatePage> HandleAsync(
        ListClientAggregatesQuery query,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(query.Aggregate))
        {
            throw new FlowProValidationException(
                "sync.aggregate.required",
                "Aggregate type is required.");
        }

        CursorPageRequest page = query.Page ?? new CursorPageRequest(Limit: 100);
        int offset = OffsetCursor.Decode(page.Cursor);
        int pageSize = page.NormalizedLimit;
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        IReadOnlyList<Domain.Sync.ClientAggregate> aggregates =
            await aggregateRepository.ListAsync(
                identity.TenantId,
                query.Aggregate,
                offset,
                pageSize + 1,
                query.IncludeDeleted,
                identity.UserId,
                query.OwnerOnly,
                cancellationToken);

        ClientAggregateItem[] items = aggregates
            .Take(pageSize)
            .Select(aggregate => new ClientAggregateItem(
                aggregate.AggregateType,
                aggregate.AggregateId,
                JsonSerializer.Deserialize<JsonElement>(aggregate.PayloadJson),
                aggregate.IsDeleted,
                aggregate.ServerVersion,
                aggregate.UpdatedAt,
                aggregate.OwnerUserId))
            .ToArray();
        string? nextCursor = aggregates.Count > pageSize
            ? OffsetCursor.Encode(offset + items.Length)
            : null;

        return new ClientAggregatePage(items, nextCursor);
    }

    private async Task<bool> CanReadMessageAsync(
        RequestIdentity identity,
        OutboxMessage message,
        JsonElement payload,
        Dictionary<string, bool> permissionCache,
        CancellationToken cancellationToken)
    {
        if (!message.EventType.StartsWith("client-aggregate.", StringComparison.Ordinal))
        {
            return false;
        }

        if (!TryReadClientAggregateSyncEvent(payload, out string aggregate, out Guid? ownerUserId))
        {
            return false;
        }

        if (ownerUserId is null || ownerUserId == identity.UserId)
        {
            return true;
        }

        string? requiredPermission = GetReadPermission(aggregate);
        if (requiredPermission is null)
        {
            return false;
        }

        if (!permissionCache.TryGetValue(requiredPermission, out bool granted))
        {
            granted = await permissionChecker.HasPermissionAsync(
                identity.TenantId,
                identity.UserId,
                requiredPermission,
                cancellationToken);
            permissionCache[requiredPermission] = granted;
        }

        return granted;
    }

    private static bool TryReadClientAggregateSyncEvent(
        JsonElement payload,
        out string aggregate,
        out Guid? ownerUserId)
    {
        aggregate = string.Empty;
        ownerUserId = null;

        if (payload.ValueKind != JsonValueKind.Object
            || !payload.TryGetProperty("aggregate", out JsonElement aggregateProperty)
            || aggregateProperty.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        aggregate = aggregateProperty.GetString() ?? string.Empty;
        if (payload.TryGetProperty("ownerUserId", out JsonElement ownerProperty)
            && ownerProperty.ValueKind == JsonValueKind.String
            && Guid.TryParse(ownerProperty.GetString(), out Guid parsedOwner))
        {
            ownerUserId = parsedOwner;
        }

        return !string.IsNullOrWhiteSpace(aggregate);
    }

    private static string? GetReadPermission(string aggregate) =>
        aggregate switch
        {
            "absence" => PermissionKeys.RequestsApprove,
            "approval-workflow" => PermissionKeys.ApprovalWorkflowsManage,
            "attachment" => PermissionKeys.RequestsApprove,
            "notification" => PermissionKeys.NotificationsManage,
            "notification-preferences" => PermissionKeys.NotificationsManage,
            "payroll-export" => PermissionKeys.PayrollExportsManage,
            "request" => PermissionKeys.RequestsApprove,
            "timesheet" => PermissionKeys.TimesheetsManage,
            "user" => PermissionKeys.UsersManage,
            _ => null,
        };
}
