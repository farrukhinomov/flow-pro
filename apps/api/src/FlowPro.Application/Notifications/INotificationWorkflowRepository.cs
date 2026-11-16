using FlowPro.Domain.Identity;
using FlowPro.Domain.Notifications;
using FlowPro.Domain.Sync;

namespace FlowPro.Application.Notifications;

public interface INotificationWorkflowRepository
{
    Task<Membership?> FindUserByIdAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<NotificationRecord>> ListNotificationsAsync(
        Guid tenantId,
        Guid recipientUserId,
        int limit,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<ClientAggregate>> ListCompatibilityNotificationsAsync(
        Guid tenantId,
        Guid recipientUserId,
        int limit,
        CancellationToken cancellationToken);

    Task<NotificationRecord?> FindNotificationAsync(
        Guid tenantId,
        string externalId,
        CancellationToken cancellationToken);

    Task<NotificationPreferencesRecord?> FindPreferencesAsync(
        Guid tenantId,
        Guid ownerUserId,
        CancellationToken cancellationToken);

    Task<ClientAggregate?> FindCompatibilityAggregateAsync(
        Guid tenantId,
        string aggregateType,
        string aggregateId,
        CancellationToken cancellationToken);

    void AddNotification(NotificationRecord notification);

    void AddPreferences(NotificationPreferencesRecord preferences);

    void AddCompatibilityAggregate(ClientAggregate aggregate);
}
