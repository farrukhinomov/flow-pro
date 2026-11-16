using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Operations;

namespace FlowPro.Application.Tests.Operations;

public sealed class OperationsHealthHandlerTests
{
    private static readonly Guid TenantId = Guid.Parse("01975fa8-7590-7000-8000-000000009101");
    private static readonly Guid ActorUserId = Guid.Parse("01975fa8-7590-7000-8000-000000009102");
    private static readonly DateTimeOffset Now = new(2026, 6, 14, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task GetOperationsHealthReturnsRepositorySnapshot()
    {
        TestFixture fixture = new();
        fixture.Repository.Snapshot = new OperationsHealthSnapshot(
            Now,
            PendingOutboxCount: 2,
            FailedOutboxCount: 0,
            OldestPendingOutboxAt: Now.AddMinutes(-10),
            LastProcessedOutboxAt: Now.AddMinutes(-1),
            LastOutboxError: null,
            AuditEventCount: 24,
            LastAuditEventAt: Now.AddMinutes(-2),
            ClientAggregateCount: 42,
            LastProjectionUpdatedAt: Now.AddMinutes(-3));

        OperationsHealthDto result = await fixture.Handler.HandleAsync(
            new GetOperationsHealthQuery(),
            CancellationToken.None);

        Assert.Equal("warning", result.Status);
        Assert.Equal(2, result.PendingOutboxCount);
        Assert.Equal(24, result.AuditEventCount);
        Assert.Equal(TenantId, fixture.Repository.LastTenantId);
        Assert.Equal(Now, fixture.Repository.LastGeneratedAt);
    }

    [Fact]
    public async Task GetOperationsHealthMarksFailedOutboxCritical()
    {
        TestFixture fixture = new();
        fixture.Repository.Snapshot = new OperationsHealthSnapshot(
            Now,
            PendingOutboxCount: 1,
            FailedOutboxCount: 1,
            OldestPendingOutboxAt: Now.AddMinutes(-10),
            LastProcessedOutboxAt: Now.AddMinutes(-1),
            LastOutboxError: "Dispatcher failed.",
            AuditEventCount: 24,
            LastAuditEventAt: Now.AddMinutes(-2),
            ClientAggregateCount: 42,
            LastProjectionUpdatedAt: Now.AddMinutes(-3));

        OperationsHealthDto result = await fixture.Handler.HandleAsync(
            new GetOperationsHealthQuery(),
            CancellationToken.None);

        Assert.Equal("critical", result.Status);
        Assert.Equal("Dispatcher failed.", result.LastOutboxError);
    }

    [Fact]
    public async Task GetOperationsHealthRequiresAuditPermission()
    {
        TestFixture fixture = new();
        fixture.PermissionChecker.DeniedPermissions.Add(PermissionKeys.AuditViewFull);

        await Assert.ThrowsAsync<FlowProForbiddenException>(
            () => fixture.Handler.HandleAsync(new GetOperationsHealthQuery(), CancellationToken.None));
    }

    private sealed class TestFixture
    {
        public TestFixture()
        {
            RequestContext = new FakeRequestContext();
            PermissionChecker = new FakePermissionChecker();
            Repository = new FakeOperationsHealthRepository();
            TimeProvider = new FakeTimeProvider(Now);
            Handler = new OperationsHealthHandler(RequestContext, PermissionChecker, Repository, TimeProvider);
        }

        public OperationsHealthHandler Handler { get; }

        public FakePermissionChecker PermissionChecker { get; }

        public FakeOperationsHealthRepository Repository { get; }

        private FakeRequestContext RequestContext { get; }

        private TimeProvider TimeProvider { get; }
    }

    private sealed class FakeRequestContext : ICurrentRequestContext
    {
        private static readonly RequestIdentity Identity = new(TenantId, ActorUserId);

        public RequestIdentity GetRequiredIdentity() => Identity;

        public RequestIdentity? TryGetIdentity() => Identity;
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

    private sealed class FakeOperationsHealthRepository : IOperationsHealthRepository
    {
        public OperationsHealthSnapshot Snapshot { get; set; } = new(
            Now,
            PendingOutboxCount: 0,
            FailedOutboxCount: 0,
            OldestPendingOutboxAt: null,
            LastProcessedOutboxAt: null,
            LastOutboxError: null,
            AuditEventCount: 0,
            LastAuditEventAt: null,
            ClientAggregateCount: 0,
            LastProjectionUpdatedAt: null);

        public DateTimeOffset? LastGeneratedAt { get; private set; }

        public Guid? LastTenantId { get; private set; }

        public Task<OperationsHealthSnapshot> GetSnapshotAsync(
            Guid tenantId,
            DateTimeOffset generatedAt,
            CancellationToken cancellationToken)
        {
            LastTenantId = tenantId;
            LastGeneratedAt = generatedAt;
            return Task.FromResult(Snapshot with { GeneratedAt = generatedAt });
        }
    }

    private sealed class FakeTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
