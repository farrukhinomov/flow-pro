using FlowPro.Application.Audit;
using FlowPro.Application.Common;
using FlowPro.Application.Integration;
using FlowPro.Application.Notifications;
using FlowPro.Domain.Audit;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Integration;
using FlowPro.Domain.Notifications;
using FlowPro.Domain.Sync;

namespace FlowPro.Application.Tests.Notifications;

public sealed class NotificationWorkflowHandlerTests
{
    private static readonly Guid TenantId = Guid.Parse("01975fa8-7590-7000-8000-000000006001");
    private static readonly Guid UserId = Guid.Parse("01975fa8-7590-7000-8000-000000006002");
    private static readonly DateTimeOffset Now = new(2026, 6, 14, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task ListNotificationsKeepsLegacyDefaultPage()
    {
        TestFixture fixture = new();
        fixture.Repository.Notifications.Add(CreateNotification("notification-1", "request.decision", "Approved", Now.AddMinutes(-1)));
        fixture.Repository.Notifications.Add(CreateNotification("notification-2", "timesheet.exception", "Missing break", Now));

        NotificationPage result = await fixture.Handler.HandleAsync(
            new ListNotificationsQuery(),
            CancellationToken.None);

        Assert.Null(result.NextCursor);
        Assert.Equal(["notification-2", "notification-1"], result.Items.Select(notification => notification.Id));
    }

    [Fact]
    public async Task ListNotificationsSupportsCursorPages()
    {
        TestFixture fixture = new();
        fixture.Repository.Notifications.Add(CreateNotification("notification-1", "request.decision", "Approved", Now.AddMinutes(-2)));
        fixture.Repository.Notifications.Add(CreateNotification("notification-2", "timesheet.exception", "Missing break", Now.AddMinutes(-1)));
        fixture.Repository.Notifications.Add(CreateNotification("notification-3", "sync.failure", "Sync failed", Now));

        NotificationPage firstPage = await fixture.Handler.HandleAsync(
            new ListNotificationsQuery(new CursorPageRequest(Limit: 2)),
            CancellationToken.None);
        NotificationPage secondPage = await fixture.Handler.HandleAsync(
            new ListNotificationsQuery(new CursorPageRequest(firstPage.NextCursor, 2)),
            CancellationToken.None);

        Assert.Equal(["notification-3", "notification-2"], firstPage.Items.Select(notification => notification.Id));
        Assert.NotNull(firstPage.NextCursor);
        Assert.Equal(["notification-1"], secondPage.Items.Select(notification => notification.Id));
        Assert.Null(secondPage.NextCursor);
    }

    [Fact]
    public async Task ListNotificationsSupportsStructuredFilters()
    {
        TestFixture fixture = new();
        NotificationRecord read = CreateNotification(
            "notification-read",
            "request.decision",
            "Approved vacation",
            Now.AddMinutes(-1),
            "request-1");
        read.MarkRead(Now);
        fixture.Repository.Notifications.Add(read);
        fixture.Repository.Notifications.Add(CreateNotification(
            "notification-unread",
            "request.decision",
            "Rejected vacation",
            Now,
            "request-2"));
        fixture.Repository.Notifications.Add(CreateNotification(
            "notification-sync",
            "sync.failure",
            "Sync failed",
            Now.AddMinutes(-2),
            "sync-1"));

        NotificationPage result = await fixture.Handler.HandleAsync(
            new ListNotificationsQuery(
                new CursorPageRequest(Limit: 10),
                new NotificationFilter(Unread: true, Type: "request.decision", Search: "rejected")),
            CancellationToken.None);

        Assert.Equal(["notification-unread"], result.Items.Select(notification => notification.Id));
        Assert.Null(result.NextCursor);
    }

    private static NotificationRecord CreateNotification(
        string id,
        string type,
        string title,
        DateTimeOffset createdAt,
        string? sourceId = null) =>
        new(TenantId, id, UserId, type, title, sourceId, createdAt);

    private sealed class TestFixture
    {
        public TestFixture()
        {
            Repository = new FakeNotificationWorkflowRepository();
            Handler = new NotificationWorkflowHandler(
                new FakeRequestContext(),
                Repository,
                new FakeAuditWriter(),
                new FakeOutbox(),
                new FakeUnitOfWork(),
                new FixedTimeProvider());
        }

        public NotificationWorkflowHandler Handler { get; }

        public FakeNotificationWorkflowRepository Repository { get; }
    }

    private sealed class FakeRequestContext : ICurrentRequestContext
    {
        public RequestIdentity GetRequiredIdentity() => new(TenantId, UserId);

        public RequestIdentity? TryGetIdentity() => GetRequiredIdentity();
    }

    private sealed class FakeUnitOfWork : IUnitOfWork
    {
        public Task<TResult> ExecuteAsync<TResult>(
            Func<CancellationToken, Task<TResult>> operation,
            CancellationToken cancellationToken) =>
            operation(cancellationToken);
    }

    private sealed class FixedTimeProvider : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private sealed class FakeNotificationWorkflowRepository : INotificationWorkflowRepository
    {
        private readonly Membership user = new(
            TenantId,
            "usr-notification-owner",
            "owner@flowpro.test",
            "Notification Owner",
            UserId);

        public List<NotificationRecord> Notifications { get; } = [];

        public List<NotificationPreferencesRecord> Preferences { get; } = [];

        public List<ClientAggregate> CompatibilityAggregates { get; } = [];

        public Task<Membership?> FindUserByIdAsync(
            Guid tenantId,
            Guid userId,
            CancellationToken cancellationToken) =>
            Task.FromResult<Membership?>(tenantId == TenantId && userId == UserId ? user : null);

        public Task<IReadOnlyList<NotificationRecord>> ListNotificationsAsync(
            Guid tenantId,
            Guid recipientUserId,
            int limit,
            CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<NotificationRecord>>(
                Notifications
                    .Where(notification => notification.TenantId == tenantId
                        && notification.RecipientUserId == recipientUserId)
                    .OrderByDescending(notification => notification.CreatedAtUtc)
                    .Take(limit)
                    .ToArray());

        public Task<IReadOnlyList<ClientAggregate>> ListCompatibilityNotificationsAsync(
            Guid tenantId,
            Guid recipientUserId,
            int limit,
            CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<ClientAggregate>>(
                CompatibilityAggregates
                    .Where(aggregate => aggregate.TenantId == tenantId
                        && aggregate.AggregateType == "notification"
                        && aggregate.OwnerUserId == recipientUserId
                        && !aggregate.IsDeleted)
                    .OrderByDescending(aggregate => aggregate.UpdatedAt)
                    .Take(limit)
                    .ToArray());

        public Task<NotificationRecord?> FindNotificationAsync(
            Guid tenantId,
            string externalId,
            CancellationToken cancellationToken) =>
            Task.FromResult(Notifications.SingleOrDefault(notification =>
                notification.TenantId == tenantId && notification.ExternalId == externalId));

        public Task<NotificationPreferencesRecord?> FindPreferencesAsync(
            Guid tenantId,
            Guid ownerUserId,
            CancellationToken cancellationToken) =>
            Task.FromResult(Preferences.SingleOrDefault(preferences =>
                preferences.TenantId == tenantId && preferences.OwnerUserId == ownerUserId));

        public Task<ClientAggregate?> FindCompatibilityAggregateAsync(
            Guid tenantId,
            string aggregateType,
            string aggregateId,
            CancellationToken cancellationToken) =>
            Task.FromResult(CompatibilityAggregates.SingleOrDefault(aggregate =>
                aggregate.TenantId == tenantId
                && aggregate.AggregateType == aggregateType
                && aggregate.AggregateId == aggregateId));

        public void AddNotification(NotificationRecord notification) => Notifications.Add(notification);

        public void AddPreferences(NotificationPreferencesRecord preferences) => Preferences.Add(preferences);

        public void AddCompatibilityAggregate(ClientAggregate aggregate) => CompatibilityAggregates.Add(aggregate);
    }

    private sealed class FakeAuditWriter : IAuditWriter
    {
        public void Add(AuditEvent auditEvent)
        {
        }
    }

    private sealed class FakeOutbox : IOutboxWriter
    {
        public void Add(OutboxMessage message)
        {
        }
    }
}
