using FlowPro.Application.Notifications;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Notifications;
using FlowPro.Domain.Sync;
using FlowPro.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Infrastructure.Notifications;

internal sealed class NotificationWorkflowRepository(FlowProDbContext dbContext)
    : INotificationWorkflowRepository
{
    public Task<Membership?> FindUserByIdAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken) =>
        dbContext.Users.SingleOrDefaultAsync(
            user => user.TenantId == tenantId && user.Id == userId,
            cancellationToken);

    public async Task<IReadOnlyList<NotificationRecord>> ListNotificationsAsync(
        Guid tenantId,
        Guid recipientUserId,
        int limit,
        CancellationToken cancellationToken) =>
        await dbContext.NotificationRecords
            .Where(notification => notification.TenantId == tenantId
                && notification.RecipientUserId == recipientUserId)
            .OrderByDescending(notification => notification.CreatedAtUtc)
            .Take(limit)
            .ToArrayAsync(cancellationToken);

    public async Task<IReadOnlyList<ClientAggregate>> ListCompatibilityNotificationsAsync(
        Guid tenantId,
        Guid recipientUserId,
        int limit,
        CancellationToken cancellationToken) =>
        await dbContext.ClientAggregates
            .Where(aggregate => aggregate.TenantId == tenantId
                && aggregate.AggregateType == "notification"
                && !aggregate.IsDeleted
                && aggregate.OwnerUserId == recipientUserId)
            .OrderByDescending(aggregate => aggregate.UpdatedAt)
            .Take(limit)
            .ToArrayAsync(cancellationToken);

    public Task<NotificationRecord?> FindNotificationAsync(
        Guid tenantId,
        string externalId,
        CancellationToken cancellationToken) =>
        dbContext.NotificationRecords.SingleOrDefaultAsync(
            notification => notification.TenantId == tenantId
                && notification.ExternalId == externalId,
            cancellationToken);

    public Task<NotificationPreferencesRecord?> FindPreferencesAsync(
        Guid tenantId,
        Guid ownerUserId,
        CancellationToken cancellationToken) =>
        dbContext.NotificationPreferences.SingleOrDefaultAsync(
            preferences => preferences.TenantId == tenantId
                && preferences.OwnerUserId == ownerUserId,
            cancellationToken);

    public Task<ClientAggregate?> FindCompatibilityAggregateAsync(
        Guid tenantId,
        string aggregateType,
        string aggregateId,
        CancellationToken cancellationToken) =>
        dbContext.ClientAggregates.SingleOrDefaultAsync(
            aggregate => aggregate.TenantId == tenantId
                && aggregate.AggregateType == aggregateType
                && aggregate.AggregateId == aggregateId,
            cancellationToken);

    public void AddNotification(NotificationRecord notification) =>
        dbContext.NotificationRecords.Add(notification);

    public void AddPreferences(NotificationPreferencesRecord preferences) =>
        dbContext.NotificationPreferences.Add(preferences);

    public void AddCompatibilityAggregate(ClientAggregate aggregate) =>
        dbContext.ClientAggregates.Add(aggregate);
}
