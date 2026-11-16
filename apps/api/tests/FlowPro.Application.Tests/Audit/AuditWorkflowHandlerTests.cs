using FlowPro.Application.Audit;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Domain.Audit;

namespace FlowPro.Application.Tests.Audit;

public sealed class AuditWorkflowHandlerTests
{
    private static readonly Guid TenantId = Guid.Parse("01975fa8-7590-7000-8000-000000009001");
    private static readonly Guid ActorUserId = Guid.Parse("01975fa8-7590-7000-8000-000000009002");
    private static readonly DateTimeOffset Now = new(2026, 6, 14, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task ListAuditEventsSupportsCursorPages()
    {
        TestFixture fixture = new();
        fixture.Repository.Events.Add(CreateEvent("request.submitted.v1", "request", Now.AddMinutes(-2)));
        fixture.Repository.Events.Add(CreateEvent("timesheet.signed.v1", "timesheet", Now.AddMinutes(-1)));
        fixture.Repository.Events.Add(CreateEvent("user.upserted.v1", "user", Now));

        AuditEventPage firstPage = await fixture.Handler.HandleAsync(
            new ListAuditEventsQuery(new CursorPageRequest(Limit: 2)),
            CancellationToken.None);
        AuditEventPage secondPage = await fixture.Handler.HandleAsync(
            new ListAuditEventsQuery(new CursorPageRequest(firstPage.NextCursor, 2)),
            CancellationToken.None);

        Assert.Equal(["user.upserted.v1", "timesheet.signed.v1"], firstPage.Items.Select(item => item.Action));
        Assert.NotNull(firstPage.NextCursor);
        Assert.Equal(["request.submitted.v1"], secondPage.Items.Select(item => item.Action));
        Assert.Null(secondPage.NextCursor);
    }

    [Fact]
    public async Task ListAuditEventsSupportsStructuredFilters()
    {
        TestFixture fixture = new();
        fixture.Repository.Events.Add(CreateEvent("request.submitted.v1", "request", Now.AddMinutes(-2), "vacation"));
        fixture.Repository.Events.Add(CreateEvent("timesheet.signed.v1", "timesheet", Now.AddMinutes(-1), "signed"));
        fixture.Repository.Events.Add(CreateEvent("request.approved.v1", "request", Now, "approval"));

        AuditEventPage result = await fixture.Handler.HandleAsync(
            new ListAuditEventsQuery(
                new CursorPageRequest(Limit: 10),
                new AuditEventFilter(AggregateType: "request", Search: "approval")),
            CancellationToken.None);

        Assert.Equal(["request.approved.v1"], result.Items.Select(item => item.Action));
        Assert.Null(result.NextCursor);
    }

    [Fact]
    public async Task ListAuditEventsRequiresAuditPermission()
    {
        TestFixture fixture = new();
        fixture.PermissionChecker.DeniedPermissions.Add(PermissionKeys.AuditViewFull);

        await Assert.ThrowsAsync<FlowProForbiddenException>(
            () => fixture.Handler.HandleAsync(new ListAuditEventsQuery(), CancellationToken.None));
    }

    private static AuditEvent CreateEvent(
        string action,
        string aggregateType,
        DateTimeOffset occurredAt,
        string detail = "{}") =>
        new(TenantId, ActorUserId, action, aggregateType, Guid.CreateVersion7(), $$"""{"detail":"{{detail}}"}""", occurredAt);

    private sealed class TestFixture
    {
        public TestFixture()
        {
            RequestContext = new FakeRequestContext();
            PermissionChecker = new FakePermissionChecker();
            Repository = new FakeAuditEventRepository();
            Handler = new AuditWorkflowHandler(RequestContext, PermissionChecker, Repository);
        }

        public AuditWorkflowHandler Handler { get; }

        public FakePermissionChecker PermissionChecker { get; }

        public FakeAuditEventRepository Repository { get; }

        public FakeRequestContext RequestContext { get; }
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

    private sealed class FakeAuditEventRepository : IAuditEventRepository
    {
        public List<AuditEvent> Events { get; } = [];

        public Task<IReadOnlyList<AuditEvent>> ListAsync(
            Guid tenantId,
            AuditEventFilter? filter,
            int offset,
            int limit,
            CancellationToken cancellationToken)
        {
            IEnumerable<AuditEvent> query = Events.Where(item => item.TenantId == tenantId);

            if (!string.IsNullOrWhiteSpace(filter?.AggregateType))
            {
                query = query.Where(item => item.AggregateType == filter.AggregateType);
            }

            if (filter?.ActorUserId is { } actorUserId)
            {
                query = query.Where(item => item.ActorUserId == actorUserId);
            }

            if (!string.IsNullOrWhiteSpace(filter?.Action))
            {
                query = query.Where(item => item.Action == filter.Action);
            }

            if (!string.IsNullOrWhiteSpace(filter?.Search))
            {
                query = query.Where(item =>
                    item.Action.Contains(filter.Search, StringComparison.OrdinalIgnoreCase)
                    || item.AggregateType.Contains(filter.Search, StringComparison.OrdinalIgnoreCase)
                    || item.DetailsJson.Contains(filter.Search, StringComparison.OrdinalIgnoreCase));
            }

            return Task.FromResult<IReadOnlyList<AuditEvent>>(
                query
                    .OrderByDescending(item => item.OccurredAt)
                    .Skip(offset)
                    .Take(limit)
                    .ToArray());
        }
    }
}
