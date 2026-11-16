using System.Text.Json;
using FlowPro.Application.Audit;
using FlowPro.Application.Common;
using FlowPro.Application.Integration;
using FlowPro.Domain.Audit;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Integration;
using FlowPro.Domain.Notifications;
using FlowPro.Domain.Sync;

namespace FlowPro.Application.Notifications;

public sealed class NotificationWorkflowHandler(
    ICurrentRequestContext requestContext,
    INotificationWorkflowRepository repository,
    IAuditWriter auditWriter,
    IOutboxWriter outboxWriter,
    IUnitOfWork unitOfWork,
    TimeProvider timeProvider) :
    IQueryHandler<ListNotificationsQuery, NotificationPage>,
    IQueryHandler<GetNotificationPreferencesQuery, NotificationPreferencesDto>,
    ICommandHandler<MarkNotificationReadCommand, NotificationDto>,
    ICommandHandler<MarkAllNotificationsReadCommand, MarkAllNotificationsReadResult>,
    ICommandHandler<SaveNotificationPreferencesCommand, NotificationPreferencesDto>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<NotificationPage> HandleAsync(
        ListNotificationsQuery query,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        Membership user = await GetCurrentUserAsync(identity, cancellationToken);
        int fetchLimit = query.Page is null
            ? CursorPageRequest.DefaultLimit
            : query.Page.NormalizedLimit + OffsetCursor.Decode(query.Page.Cursor);

        return await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                await HydrateCompatibilityNotificationsAsync(
                    identity.TenantId,
                    identity.UserId,
                    fetchLimit,
                    transactionCancellationToken);

                IReadOnlyList<NotificationRecord> notifications = await repository.ListNotificationsAsync(
                    identity.TenantId,
                    identity.UserId,
                    Math.Min(fetchLimit + 1, CursorPageRequest.MaxLimit + fetchLimit),
                    transactionCancellationToken);

                NotificationDto[] items = notifications
                    .Select(notification => Map(notification, user))
                    .Where(notification => MatchesFilter(notification, query.Filter))
                    .OrderByDescending(notification => notification.CreatedAt)
                    .ToArray();

                if (query.Page is null)
                {
                    return new NotificationPage(items.Take(CursorPageRequest.DefaultLimit).ToArray());
                }

                int offset = OffsetCursor.Decode(query.Page.Cursor);
                int limit = query.Page.NormalizedLimit;
                NotificationDto[] pageItems = items
                    .Skip(offset)
                    .Take(limit)
                    .ToArray();
                int nextOffset = offset + pageItems.Length;
                string? nextCursor = nextOffset < items.Length ? OffsetCursor.Encode(nextOffset) : null;

                return new NotificationPage(pageItems, nextCursor);
            },
            cancellationToken);
    }

    public async Task<NotificationPreferencesDto> HandleAsync(
        GetNotificationPreferencesQuery query,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        Membership user = await GetCurrentUserAsync(identity, cancellationToken);
        NotificationPreferencesRecord? preferences = await repository.FindPreferencesAsync(
            identity.TenantId,
            identity.UserId,
            cancellationToken);

        return preferences is null ? DefaultPreferences(user) : Map(preferences, user);
    }

    public async Task<NotificationDto> HandleAsync(
        MarkNotificationReadCommand command,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        Membership user = await GetCurrentUserAsync(identity, cancellationToken);

        return await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                NotificationRecord notification = await repository.FindNotificationAsync(
                        identity.TenantId,
                        command.NotificationId,
                        transactionCancellationToken)
                    ?? throw new FlowProNotFoundException(
                        "notification.not_found",
                        "Notification was not found.");

                if (notification.RecipientUserId != identity.UserId)
                {
                    throw new FlowProForbiddenException(
                        "notification.self_required",
                        "Notifications can only be changed by their recipient.");
                }

                DateTimeOffset now = timeProvider.GetUtcNow();
                notification.MarkRead(now);
                await UpsertNotificationCompatibilityAsync(notification, user, transactionCancellationToken);
                AddAuditAndOutbox(identity, "notification.read.v1", notification.ExternalId, Map(notification, user), now);

                return Map(notification, user);
            },
            cancellationToken);
    }

    public async Task<MarkAllNotificationsReadResult> HandleAsync(
        MarkAllNotificationsReadCommand command,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        Membership user = await GetCurrentUserAsync(identity, cancellationToken);

        return await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                IReadOnlyList<NotificationRecord> notifications = await repository.ListNotificationsAsync(
                    identity.TenantId,
                    identity.UserId,
                    200,
                    transactionCancellationToken);
                DateTimeOffset now = timeProvider.GetUtcNow();
                int changed = 0;

                foreach (NotificationRecord notification in notifications.Where(item => item.ReadAt is null))
                {
                    notification.MarkRead(now);
                    await UpsertNotificationCompatibilityAsync(notification, user, transactionCancellationToken);
                    changed++;
                }

                if (changed > 0)
                {
                    AddAuditAndOutbox(
                        identity,
                        "notification.read-all.v1",
                        identity.UserId.ToString(),
                        new { ChangedCount = changed },
                        now);
                }

                return new MarkAllNotificationsReadResult(changed);
            },
            cancellationToken);
    }

    public async Task<NotificationPreferencesDto> HandleAsync(
        SaveNotificationPreferencesCommand command,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        Membership user = await GetCurrentUserAsync(identity, cancellationToken);

        return await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                NotificationPreferencesRecord? preferences = await repository.FindPreferencesAsync(
                    identity.TenantId,
                    identity.UserId,
                    transactionCancellationToken);

                if (preferences is null)
                {
                    preferences = new NotificationPreferencesRecord(
                        identity.TenantId,
                        identity.UserId,
                        command.ApprovalQueue,
                        command.RequestDecisions,
                        command.SecurityEmails,
                        command.SyncFailures,
                        command.TimesheetExceptions,
                        command.WeeklySummary);
                    repository.AddPreferences(preferences);
                }
                else
                {
                    preferences.Update(
                        command.ApprovalQueue,
                        command.RequestDecisions,
                        command.SecurityEmails,
                        command.SyncFailures,
                        command.TimesheetExceptions,
                        command.WeeklySummary);
                }

                NotificationPreferencesDto dto = Map(preferences, user);
                DateTimeOffset now = timeProvider.GetUtcNow();
                await UpsertPreferencesCompatibilityAsync(dto, identity.TenantId, transactionCancellationToken);
                AddAuditAndOutbox(identity, "notification.preferences.saved.v1", dto.Id, dto, now);

                return dto;
            },
            cancellationToken);
    }

    private async Task HydrateCompatibilityNotificationsAsync(
        Guid tenantId,
        Guid recipientUserId,
        int limit,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<ClientAggregate> aggregates = await repository.ListCompatibilityNotificationsAsync(
            tenantId,
            recipientUserId,
            limit,
            cancellationToken);

        foreach (ClientAggregate aggregate in aggregates)
        {
            if (await repository.FindNotificationAsync(tenantId, aggregate.AggregateId, cancellationToken) is not null)
            {
                continue;
            }

            JsonElement payload = JsonSerializer.Deserialize<JsonElement>(aggregate.PayloadJson, JsonOptions);
            string type = ReadString(payload, "type") ?? "notification";
            string title = ReadString(payload, "title") ?? "Notification";
            string? sourceId = ReadString(payload, "sourceId");
            DateTimeOffset createdAt = ReadDate(payload, "createdAt") ?? aggregate.CreatedAt;
            NotificationRecord notification = new(
                tenantId,
                aggregate.AggregateId,
                recipientUserId,
                type,
                title,
                sourceId,
                createdAt);

            if (ReadDate(payload, "readAt") is { } readAt)
            {
                notification.MarkRead(readAt);
            }

            repository.AddNotification(notification);
        }
    }

    private async Task UpsertNotificationCompatibilityAsync(
        NotificationRecord notification,
        Membership user,
        CancellationToken cancellationToken)
    {
        NotificationDto dto = Map(notification, user);
        string payloadJson = JsonSerializer.Serialize(dto, JsonOptions);
        ClientAggregate? aggregate = await repository.FindCompatibilityAggregateAsync(
            notification.TenantId,
            "notification",
            notification.ExternalId,
            cancellationToken);
        string operationId = $"server-notification-{notification.ExternalId}-{notification.Version}";

        if (aggregate is null)
        {
            repository.AddCompatibilityAggregate(
                new ClientAggregate(
                    notification.TenantId,
                    "notification",
                    notification.ExternalId,
                    payloadJson,
                    operationId,
                    timeProvider.GetUtcNow(),
                    notification.RecipientUserId));
            return;
        }

        aggregate.Upsert(payloadJson, operationId, timeProvider.GetUtcNow());
    }

    private async Task UpsertPreferencesCompatibilityAsync(
        NotificationPreferencesDto preferences,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        string payloadJson = JsonSerializer.Serialize(preferences, JsonOptions);
        ClientAggregate? aggregate = await repository.FindCompatibilityAggregateAsync(
            tenantId,
            "notification-preferences",
            preferences.Id,
            cancellationToken);
        string operationId = $"server-notification-preferences-{preferences.OwnerUserId}-{preferences.UpdatedAt:O}";

        if (aggregate is null)
        {
            repository.AddCompatibilityAggregate(
                new ClientAggregate(
                    tenantId,
                    "notification-preferences",
                    preferences.Id,
                    payloadJson,
                    operationId,
                    timeProvider.GetUtcNow(),
                    ownerUserId: null));
            return;
        }

        aggregate.Upsert(payloadJson, operationId, timeProvider.GetUtcNow());
    }

    private void AddAuditAndOutbox(
        RequestIdentity identity,
        string eventType,
        string aggregateId,
        object payload,
        DateTimeOffset now)
    {
        string payloadJson = JsonSerializer.Serialize(payload, JsonOptions);
        Guid stableId = StableGuid($"notification:{aggregateId}");

        outboxWriter.Add(
            new OutboxMessage(
                identity.TenantId,
                eventType,
                "notification",
                stableId,
                payloadJson,
                now));
        auditWriter.Add(
            new AuditEvent(
                identity.TenantId,
                identity.UserId,
                eventType,
                "notification",
                stableId,
                payloadJson,
                now));
    }

    private async Task<Membership> GetCurrentUserAsync(
        RequestIdentity identity,
        CancellationToken cancellationToken) =>
        await repository.FindUserByIdAsync(identity.TenantId, identity.UserId, cancellationToken)
        ?? throw new FlowProUnauthorizedException();

    private static NotificationDto Map(NotificationRecord notification, Membership user) =>
        new(
            notification.ExternalId,
            user.ExternalSubject,
            notification.Type,
            notification.Title,
            notification.SourceId,
            notification.ReadAt,
            notification.CreatedAtUtc,
            "synced");

    private static NotificationPreferencesDto Map(NotificationPreferencesRecord preferences, Membership user) =>
        new(
            $"notification-preferences-{user.ExternalSubject}",
            user.ExternalSubject,
            preferences.ApprovalQueue,
            preferences.RequestDecisions,
            preferences.SecurityEmails,
            preferences.SyncFailures,
            preferences.TimesheetExceptions,
            preferences.WeeklySummary,
            preferences.UpdatedAt);

    private static NotificationPreferencesDto DefaultPreferences(Membership user) =>
        new(
            $"notification-preferences-{user.ExternalSubject}",
            user.ExternalSubject,
            ApprovalQueue: true,
            RequestDecisions: true,
            SecurityEmails: true,
            SyncFailures: true,
            TimesheetExceptions: true,
            WeeklySummary: false,
            DateTimeOffset.UnixEpoch);

    private static bool MatchesFilter(NotificationDto notification, NotificationFilter? filter)
    {
        if (filter is null)
        {
            return true;
        }

        if (filter.Unread is true && notification.ReadAt is not null)
        {
            return false;
        }

        if (filter.Unread is false && notification.ReadAt is null)
        {
            return false;
        }

        if (!string.IsNullOrWhiteSpace(filter.Type)
            && !notification.Type.Equals(filter.Type.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (!string.IsNullOrWhiteSpace(filter.SourceId)
            && !string.Equals(notification.SourceId, filter.SourceId.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (string.IsNullOrWhiteSpace(filter.Search))
        {
            return true;
        }

        string search = filter.Search.Trim();
        return notification.Id.Contains(search, StringComparison.OrdinalIgnoreCase)
            || notification.Type.Contains(search, StringComparison.OrdinalIgnoreCase)
            || notification.Title.Contains(search, StringComparison.OrdinalIgnoreCase)
            || (notification.SourceId?.Contains(search, StringComparison.OrdinalIgnoreCase) ?? false);
    }

    private static string? ReadString(JsonElement payload, string propertyName) =>
        payload.ValueKind == JsonValueKind.Object
        && payload.TryGetProperty(propertyName, out JsonElement value)
        && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static DateTimeOffset? ReadDate(JsonElement payload, string propertyName) =>
        payload.ValueKind == JsonValueKind.Object
        && payload.TryGetProperty(propertyName, out JsonElement value)
        && value.ValueKind == JsonValueKind.String
        && DateTimeOffset.TryParse(value.GetString(), out DateTimeOffset parsed)
            ? parsed
            : null;

    private static Guid StableGuid(string value)
    {
        byte[] bytes = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(value));
        return new Guid(bytes[..16]);
    }
}
