using FlowPro.Application.Common;

namespace FlowPro.Application.Notifications;

public sealed record ListNotificationsQuery(
    CursorPageRequest? Page = null,
    NotificationFilter? Filter = null) : IQuery<NotificationPage>;

public sealed record NotificationFilter(
    bool? Unread = null,
    string? Type = null,
    string? SourceId = null,
    string? Search = null);

public sealed record GetNotificationPreferencesQuery : IQuery<NotificationPreferencesDto>;

public sealed record MarkNotificationReadCommand(string NotificationId) : ICommand<NotificationDto>;

public sealed record MarkAllNotificationsReadCommand : ICommand<MarkAllNotificationsReadResult>;

public sealed record SaveNotificationPreferencesCommand(
    bool ApprovalQueue,
    bool RequestDecisions,
    bool SecurityEmails,
    bool SyncFailures,
    bool TimesheetExceptions,
    bool WeeklySummary) : ICommand<NotificationPreferencesDto>;

public sealed record NotificationPage(
    IReadOnlyList<NotificationDto> Items,
    string? NextCursor = null);

public sealed record NotificationDto(
    string Id,
    string RecipientUserId,
    string Type,
    string Title,
    string? SourceId,
    DateTimeOffset? ReadAt,
    DateTimeOffset CreatedAt,
    string SyncState);

public sealed record NotificationPreferencesDto(
    string Id,
    string OwnerUserId,
    bool ApprovalQueue,
    bool RequestDecisions,
    bool SecurityEmails,
    bool SyncFailures,
    bool TimesheetExceptions,
    bool WeeklySummary,
    DateTimeOffset UpdatedAt);

public sealed record MarkAllNotificationsReadResult(int ChangedCount);
