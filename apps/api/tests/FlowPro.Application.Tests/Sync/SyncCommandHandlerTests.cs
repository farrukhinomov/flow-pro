using System.Text.Json;
using FlowPro.Application.Audit;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Integration;
using FlowPro.Application.Sync;
using FlowPro.Domain.Audit;
using FlowPro.Domain.Integration;
using FlowPro.Domain.Sync;

namespace FlowPro.Application.Tests.Sync;

public sealed class SyncCommandHandlerTests
{
    private static readonly Guid TenantId = Guid.Parse("01975fa8-7590-7000-8000-000000001001");
    private static readonly Guid UserId = Guid.Parse("01975fa8-7590-7000-8000-000000001002");
    private static readonly DateTimeOffset Now = new(2026, 6, 4, 8, 0, 0, TimeSpan.Zero);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [Fact]
    public async Task AcceptsSyncableAggregateAndWritesOutboxEvent()
    {
        TestFixture fixture = new();

        SyncBatchResponse response = await fixture.Handler.HandleAsync(
            CreateBatch(CreateOperation("op-1", "request.submit", "request", "req-1")),
            CancellationToken.None);

        Assert.Single(response.Accepted);
        Assert.Empty(response.Conflicts);
        Assert.Empty(response.Rejected);
        Assert.Single(fixture.Repository.Aggregates);
        OutboxMessage message = Assert.Single(fixture.Outbox.Messages);
        Assert.Equal("client-aggregate.upserted.v1", message.EventType);
        AuditEvent auditEvent = Assert.Single(fixture.Audit.Events);
        Assert.Equal("request.submit", auditEvent.Action);
        Assert.Equal("request", auditEvent.AggregateType);

        ClientAggregateSyncEvent? payload = JsonSerializer.Deserialize<ClientAggregateSyncEvent>(
            message.PayloadJson,
            JsonOptions);

        Assert.NotNull(payload);
        Assert.Equal("request", payload.Aggregate);
        Assert.Equal("req-1", payload.AggregateId);
        Assert.False(payload.Deleted);
        Assert.Equal("op-1", payload.ClientOperationId);
    }

    [Fact]
    public async Task ReplayedOperationIsAcceptedWithoutAnotherOutboxEvent()
    {
        TestFixture fixture = new();
        SubmitSyncBatchCommand command = CreateBatch(
            CreateOperation("op-2", "request.submit", "request", "req-2"));

        await fixture.Handler.HandleAsync(command, CancellationToken.None);
        SyncBatchResponse replay = await fixture.Handler.HandleAsync(command, CancellationToken.None);

        Assert.Single(replay.Accepted);
        Assert.Single(fixture.Repository.Aggregates);
        Assert.Single(fixture.Outbox.Messages);
        Assert.Single(fixture.Audit.Events);
    }

    [Fact]
    public async Task ListsClientAggregatesWithCursorPages()
    {
        TestFixture fixture = new();
        fixture.Repository.Add(CreateAggregate("req-1"));
        fixture.Repository.Add(CreateAggregate("req-2"));
        fixture.Repository.Add(CreateAggregate("req-3"));

        ClientAggregatePage firstPage = await fixture.QueryHandler.HandleAsync(
            new ListClientAggregatesQuery("request", new CursorPageRequest(Limit: 2), false, true),
            CancellationToken.None);
        ClientAggregatePage secondPage = await fixture.QueryHandler.HandleAsync(
            new ListClientAggregatesQuery("request", new CursorPageRequest(firstPage.NextCursor, 2), false, true),
            CancellationToken.None);

        Assert.Equal(["req-1", "req-2"], firstPage.Items.Select(item => item.AggregateId));
        Assert.NotNull(firstPage.NextCursor);
        Assert.Equal(["req-3"], secondPage.Items.Select(item => item.AggregateId));
        Assert.Null(secondPage.NextCursor);
    }

    [Fact]
    public async Task ListsClientAggregatesRespectOwnerScopeAndDeletedFilter()
    {
        TestFixture fixture = new();
        Guid otherUserId = Guid.Parse("01975fa8-7590-7000-8000-000000001099");
        fixture.Repository.Add(CreateAggregate("own-visible"));
        fixture.Repository.Add(CreateAggregate("other-hidden", otherUserId));
        ClientAggregate deleted = CreateAggregate("own-deleted");
        deleted.Delete("delete-own-deleted", Now.AddMinutes(1));
        fixture.Repository.Add(deleted);

        ClientAggregatePage ownActive = await fixture.QueryHandler.HandleAsync(
            new ListClientAggregatesQuery("request", new CursorPageRequest(Limit: 10), false, true),
            CancellationToken.None);
        ClientAggregatePage ownIncludingDeleted = await fixture.QueryHandler.HandleAsync(
            new ListClientAggregatesQuery("request", new CursorPageRequest(Limit: 10), true, true),
            CancellationToken.None);

        Assert.Equal(["own-visible"], ownActive.Items.Select(item => item.AggregateId));
        Assert.Equal(["own-visible", "own-deleted"], ownIncludingDeleted.Items.Select(item => item.AggregateId));
    }

    [Fact]
    public async Task OlderOperationConflictsUnlessClientExplicitlyChoosesLocalWins()
    {
        TestFixture fixture = new();
        ClientAggregate current = new(
            TenantId,
            "request",
            "req-3",
            JsonSerializer.Serialize(new { id = "req-3", status = "submitted" }, JsonOptions),
            "server-op",
            Now.AddMinutes(5),
            UserId);
        fixture.Repository.Add(current);

        SyncBatchResponse conflict = await fixture.Handler.HandleAsync(
            CreateBatch(CreateOperation("op-3", "request.approve", "request", "req-3")),
            CancellationToken.None);

        Assert.Empty(conflict.Accepted);
        SyncConflict item = Assert.Single(conflict.Conflicts);
        Assert.Equal("req-3", item.AggregateId);
        Assert.Empty(fixture.Outbox.Messages);
        Assert.Empty(fixture.Audit.Events);

        SyncBatchResponse resolved = await fixture.Handler.HandleAsync(
            CreateBatch(
                CreateOperation(
                    "op-4",
                    "request.approve",
                    "request",
                    "req-3",
                    new ClientSyncConflictResolution("local-wins"))),
            CancellationToken.None);

        Assert.Single(resolved.Accepted);
        Assert.Single(fixture.Outbox.Messages);
        Assert.Single(fixture.Audit.Events);
    }

    [Fact]
    public async Task RejectsGenericClockEventWritesBecauseAttendanceApiIsAuthoritative()
    {
        TestFixture fixture = new();

        SyncBatchResponse response = await fixture.Handler.HandleAsync(
            CreateBatch(CreateOperation("op-5", "clock-event.create", "clock-event", "clock-1")),
            CancellationToken.None);

        SyncRejectedOperation rejected = Assert.Single(response.Rejected);
        Assert.Contains("not syncable", rejected.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(response.Accepted);
        Assert.Empty(fixture.Repository.Aggregates);
        Assert.Empty(fixture.Audit.Events);
    }

    [Fact]
    public async Task RejectsSensitiveOperationsWithoutRequiredPermission()
    {
        TestFixture fixture = new();
        fixture.PermissionChecker.DeniedPermissions.Add(PermissionKeys.UsersManage);

        SyncBatchResponse response = await fixture.Handler.HandleAsync(
            CreateBatch(CreateOperation("op-6", "user.upsert", "user", "user-1")),
            CancellationToken.None);

        SyncRejectedOperation rejected = Assert.Single(response.Rejected);
        Assert.Contains(PermissionKeys.UsersManage, rejected.Message, StringComparison.Ordinal);
        Assert.Empty(response.Accepted);
        Assert.Empty(fixture.Repository.Aggregates);
        Assert.Empty(fixture.Audit.Events);
    }

    [Fact]
    public async Task RejectsOperationsThatDoNotMatchTheirAggregate()
    {
        TestFixture fixture = new();

        SyncBatchResponse response = await fixture.Handler.HandleAsync(
            CreateBatch(CreateOperation("op-7", "request.submit", "user", "user-1")),
            CancellationToken.None);

        SyncRejectedOperation rejected = Assert.Single(response.Rejected);
        Assert.Contains("does not match aggregate", rejected.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(response.Accepted);
        Assert.Empty(fixture.Repository.Aggregates);
        Assert.Empty(fixture.Audit.Events);
    }

    [Fact]
    public async Task RejectsUnknownConflictResolutionModes()
    {
        TestFixture fixture = new();

        SyncBatchResponse response = await fixture.Handler.HandleAsync(
            CreateBatch(
                CreateOperation(
                    "op-8",
                    "request.submit",
                    "request",
                    "req-unknown-conflict",
                    new ClientSyncConflictResolution("force"))),
            CancellationToken.None);

        SyncRejectedOperation rejected = Assert.Single(response.Rejected);
        Assert.Contains("not supported", rejected.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(response.Accepted);
        Assert.Empty(fixture.Repository.Aggregates);
        Assert.Empty(fixture.Audit.Events);
    }

    [Fact]
    public async Task AssignsOwnerToSelfServiceAggregates()
    {
        TestFixture fixture = new();

        SyncBatchResponse response = await fixture.Handler.HandleAsync(
            CreateBatch(CreateOperation("op-9", "request.submit", "request", "req-owner")),
            CancellationToken.None);

        Assert.Single(response.Accepted);
        ClientAggregate aggregate = Assert.Single(fixture.Repository.Aggregates);
        Assert.Equal(UserId, aggregate.OwnerUserId);
    }

    [Fact]
    public async Task AllowsUsersToWriteTheirOwnNotificationsWithoutManagePermission()
    {
        TestFixture fixture = new();
        fixture.PermissionChecker.DeniedPermissions.Add(PermissionKeys.NotificationsManage);

        SyncBatchResponse response = await fixture.Handler.HandleAsync(
            CreateBatch(
                CreateOperation(
                    "op-10",
                    "notification.upsert",
                    "notification",
                    "notification-own",
                    payload: new
                    {
                        id = "notification-own",
                        recipientUserId = UserId,
                        type = "request.approved",
                        title = "Request approved",
                        createdAt = Now,
                    })),
            CancellationToken.None);

        Assert.Single(response.Accepted);
        Assert.Empty(response.Rejected);
        Assert.Equal(UserId, Assert.Single(fixture.Repository.Aggregates).OwnerUserId);
    }

    [Fact]
    public async Task RejectsNotificationWritesForAnotherRecipientWithoutManagePermission()
    {
        TestFixture fixture = new();
        fixture.PermissionChecker.DeniedPermissions.Add(PermissionKeys.NotificationsManage);
        Guid otherUserId = Guid.Parse("01975fa8-7590-7000-8000-000000001099");

        SyncBatchResponse response = await fixture.Handler.HandleAsync(
            CreateBatch(
                CreateOperation(
                    "op-11",
                    "notification.upsert",
                    "notification",
                    "notification-other",
                    payload: new
                    {
                        id = "notification-other",
                        recipientUserId = otherUserId,
                        type = "request.approved",
                        title = "Request approved",
                        createdAt = Now,
                    })),
            CancellationToken.None);

        SyncRejectedOperation rejected = Assert.Single(response.Rejected);
        Assert.Contains(PermissionKeys.NotificationsManage, rejected.Message, StringComparison.Ordinal);
        Assert.Empty(response.Accepted);
        Assert.Empty(fixture.Repository.Aggregates);
    }

    [Fact]
    public async Task AllowsUsersToMarkTheirOwnNotificationsReadWithoutManagePermission()
    {
        TestFixture fixture = new();
        fixture.PermissionChecker.DeniedPermissions.Add(PermissionKeys.NotificationsManage);

        SyncBatchResponse response = await fixture.Handler.HandleAsync(
            CreateBatch(
                CreateOperation(
                    "op-12",
                    "notification.mark-read",
                    "notification",
                    "notification-read",
                    payload: new
                    {
                        id = "notification-read",
                        recipientUserId = UserId,
                        type = "request.approved",
                        title = "Request approved",
                        readAt = Now,
                        createdAt = Now.AddMinutes(-5),
                    })),
            CancellationToken.None);

        Assert.Single(response.Accepted);
        Assert.Empty(response.Rejected);
        ClientAggregate aggregate = Assert.Single(fixture.Repository.Aggregates);
        Assert.Equal(UserId, aggregate.OwnerUserId);
        Assert.Contains("readAt", aggregate.PayloadJson, StringComparison.Ordinal);
    }

    private static SubmitSyncBatchCommand CreateBatch(ClientSyncOperation operation) =>
        new("flowpro-sync-v1", "web-test-client", 9, [operation]);

    private static ClientSyncOperation CreateOperation(
        string id,
        string type,
        string aggregate,
        string aggregateId,
        ClientSyncConflictResolution? conflict = null,
        object? payload = null) =>
        new(
            id,
            type,
            aggregate,
            aggregateId,
            JsonSerializer.SerializeToElement(
                payload ?? new { id = aggregateId, status = "submitted", updatedAt = Now },
                JsonOptions),
            Now,
            conflict);

    private static ClientAggregate CreateAggregate(string aggregateId, Guid? ownerUserId = null) =>
        new(
            TenantId,
            "request",
            aggregateId,
            JsonSerializer.Serialize(new { id = aggregateId, status = "submitted" }, JsonOptions),
            $"operation-{aggregateId}",
            Now,
            ownerUserId ?? UserId);

    private sealed class TestFixture
    {
        public TestFixture()
        {
            Repository = new FakeSyncAggregateRepository();
            Outbox = new FakeOutbox();
            Audit = new FakeAuditWriter();
            PermissionChecker = new FakePermissionChecker();
            Handler = new SyncCommandHandler(
                new FakeRequestContext(),
                PermissionChecker,
                Repository,
                Outbox,
                Audit,
                new FakeUnitOfWork(),
                new FixedTimeProvider());
            QueryHandler = new SyncQueryHandler(
                new FakeRequestContext(),
                Outbox,
                PermissionChecker,
                Repository);
        }

        public SyncCommandHandler Handler { get; }

        public SyncQueryHandler QueryHandler { get; }

        public FakeSyncAggregateRepository Repository { get; }

        public FakeOutbox Outbox { get; }

        public FakeAuditWriter Audit { get; }

        public FakePermissionChecker PermissionChecker { get; }
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

    private sealed class FakeSyncAggregateRepository : ISyncAggregateRepository
    {
        public List<ClientAggregate> Aggregates { get; } = [];

        public Task<ClientAggregate?> FindAsync(
            Guid tenantId,
            string aggregateType,
            string aggregateId,
            CancellationToken cancellationToken) =>
            Task.FromResult(
                Aggregates.SingleOrDefault(aggregate =>
                    aggregate.TenantId == tenantId
                    && aggregate.AggregateType == aggregateType
                    && aggregate.AggregateId == aggregateId));

        public Task<IReadOnlyList<ClientAggregate>> ListAsync(
            Guid tenantId,
            string aggregateType,
            int offset,
            int limit,
            bool includeDeleted,
            Guid? ownerUserId,
            bool ownerOnly,
            CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<ClientAggregate>>(
                Aggregates
                    .Where(aggregate => aggregate.TenantId == tenantId
                        && aggregate.AggregateType == aggregateType
                        && (includeDeleted || !aggregate.IsDeleted)
                        && (!ownerOnly || aggregate.OwnerUserId == ownerUserId))
                    .Skip(offset)
                    .Take(limit)
                    .ToArray());

        public void Add(ClientAggregate aggregate)
        {
            if (!Aggregates.Contains(aggregate))
            {
                Aggregates.Add(aggregate);
            }
        }
    }

    private sealed class FakeOutbox : IOutboxWriter, IOutboxReader
    {
        public List<OutboxMessage> Messages { get; } = [];

        public void Add(OutboxMessage message) => Messages.Add(message);

        public Task<IReadOnlyList<OutboxMessage>> ListChangesAsync(
            Guid tenantId,
            long afterSequence,
            int limit,
            CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<OutboxMessage>>(
                Messages
                    .Where(message => message.TenantId == tenantId
                        && message.Sequence > afterSequence)
                    .Take(limit)
                    .ToArray());
    }

    private sealed class FakeAuditWriter : IAuditWriter
    {
        public List<AuditEvent> Events { get; } = [];

        public void Add(AuditEvent auditEvent) => Events.Add(auditEvent);
    }

    private sealed class FakePermissionChecker : IPermissionChecker
    {
        public HashSet<string> DeniedPermissions { get; } = [];

        public Task<bool> HasPermissionAsync(
            Guid tenantId,
            Guid userId,
            string permission,
            CancellationToken cancellationToken) =>
            Task.FromResult(!DeniedPermissions.Contains(permission));
    }
}
