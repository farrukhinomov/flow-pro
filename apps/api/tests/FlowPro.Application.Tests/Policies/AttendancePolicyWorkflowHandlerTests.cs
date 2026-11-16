using System.Text.Json;
using FlowPro.Application.Audit;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Integration;
using FlowPro.Application.Policies;
using FlowPro.Domain.Audit;
using FlowPro.Domain.Integration;
using FlowPro.Domain.Policies;
using FlowPro.Domain.Sync;

namespace FlowPro.Application.Tests.Policies;

public sealed class AttendancePolicyWorkflowHandlerTests
{
    private static readonly Guid TenantId = Guid.Parse("01975fa8-7590-7000-8000-000000009201");
    private static readonly Guid ActorUserId = Guid.Parse("01975fa8-7590-7000-8000-000000009202");
    private static readonly DateTimeOffset Now = new(2026, 6, 14, 8, 0, 0, TimeSpan.Zero);

    private static JsonElement Config(int weeklyHours = 40) =>
        JsonSerializer.Deserialize<JsonElement>($$"""
        {
          "countryCode": "DE",
          "regionCode": "DE-BE",
          "defaultWeeklyHours": {{weeklyHours}},
          "defaultWorkdays": 5,
          "vacationAnnualDays": 30,
          "vacationCarryover": {},
          "sicknessPrivacyMode": "state-only",
          "legalBreaks": {},
          "periodWindows": {},
          "approvalRules": {}
        }
        """);

    [Fact]
    public async Task PublishDefaultsEffectiveDateToNow()
    {
        TestFixture fixture = new();

        await fixture.Handler.HandleAsync(
            new PublishAttendancePolicyConfigCommand("default", Config()),
            CancellationToken.None);

        Assert.Equal(Now, Assert.Single(fixture.Repository.Added).EffectiveFrom);
    }

    [Fact]
    public async Task PublishAcceptsAFutureEffectiveDate()
    {
        // Rules agreed now that start governing later must not disturb the
        // policy in force today.
        TestFixture fixture = new();
        DateTimeOffset january = new(2027, 1, 1, 0, 0, 0, TimeSpan.Zero);

        await fixture.Handler.HandleAsync(
            new PublishAttendancePolicyConfigCommand("default", Config(), january),
            CancellationToken.None);

        AttendancePolicyVersion published = Assert.Single(fixture.Repository.Added);

        Assert.Equal(january, published.EffectiveFrom);
        Assert.Equal(Now, published.PublishedAt);
    }

    [Fact]
    public async Task PublishRejectsAnEffectiveDateBeforeTheCurrentOne()
    {
        // Back-dating behind an existing revision would make two revisions
        // claim the same past period.
        TestFixture fixture = new();
        fixture.Repository.Current = TestFixture.CreateVersion(effectiveFrom: Now);

        FlowProValidationException error =
            await Assert.ThrowsAsync<FlowProValidationException>(
                () => fixture.Handler.HandleAsync(
                    new PublishAttendancePolicyConfigCommand(
                        "default",
                        Config(38),
                        Now.AddDays(-1)),
                    CancellationToken.None));

        Assert.Equal("attendance_policy.effective_from_before_current", error.Code);
        Assert.Empty(fixture.Repository.Added);
    }

    [Fact]
    public async Task RepublishingIdenticalRulesOnTheSameDateIsANoOp()
    {
        TestFixture fixture = new();
        await fixture.Handler.HandleAsync(
            new PublishAttendancePolicyConfigCommand("default", Config()),
            CancellationToken.None);

        AttendancePolicyVersion first = Assert.Single(fixture.Repository.Added);
        fixture.Repository.Current = first;
        fixture.Repository.Added.Clear();

        await fixture.Handler.HandleAsync(
            new PublishAttendancePolicyConfigCommand("default", Config(), first.EffectiveFrom),
            CancellationToken.None);

        Assert.Empty(fixture.Repository.Added);
    }

    [Fact]
    public async Task RedatingIdenticalRulesPublishesANewVersion()
    {
        // Same rules, different start date, is a real change: it moves when
        // they begin governing work.
        TestFixture fixture = new();
        fixture.Repository.Current = TestFixture.CreateVersion(effectiveFrom: Now);

        await fixture.Handler.HandleAsync(
            new PublishAttendancePolicyConfigCommand(
                "default",
                Config(),
                Now.AddMonths(1)),
            CancellationToken.None);

        Assert.Single(fixture.Repository.Added);
    }

    [Fact]
    public async Task ReadResolvesTheRevisionGoverningTheRequestedInstant()
    {
        TestFixture fixture = new();
        DateTimeOffset asked = Now.AddMonths(-6);

        await fixture.Handler.HandleAsync(
            new GetAttendancePolicyConfigQuery("default", asked),
            CancellationToken.None);

        Assert.Equal(asked, fixture.Repository.LastEffectiveQueryAt);
    }

    [Fact]
    public async Task ReadWithoutADateResolvesAtNow()
    {
        TestFixture fixture = new();

        await fixture.Handler.HandleAsync(
            new GetAttendancePolicyConfigQuery("default"),
            CancellationToken.None);

        Assert.Equal(Now, fixture.Repository.LastEffectiveQueryAt);
    }

    [Fact]
    public async Task HistoryMarksTheRevisionInEffectRatherThanTheLatestPublished()
    {
        // The distinction the flag alone cannot express: a scheduled revision
        // is the latest published while an older one still governs today.
        TestFixture fixture = new();
        AttendancePolicyVersion governing = TestFixture.CreateVersion(
            versionNumber: 1,
            effectiveFrom: Now.AddMonths(-1));
        AttendancePolicyVersion scheduled = TestFixture.CreateVersion(
            versionNumber: 2,
            effectiveFrom: Now.AddMonths(1));
        governing.Supersede();
        fixture.Repository.Versions = [scheduled, governing];

        IReadOnlyList<AttendancePolicyVersionDto> history = await fixture.Handler.HandleAsync(
            new GetAttendancePolicyHistoryQuery("default"),
            CancellationToken.None);

        AttendancePolicyVersionDto scheduledDto = history.Single(item => item.VersionNumber == 2);
        AttendancePolicyVersionDto governingDto = history.Single(item => item.VersionNumber == 1);

        Assert.True(scheduledDto.IsLatestPublished);
        Assert.False(scheduledDto.IsInEffect);
        Assert.False(governingDto.IsLatestPublished);
        Assert.True(governingDto.IsInEffect);
    }

    [Fact]
    public async Task HistoryRequiresThePolicyManagePermission()
    {
        TestFixture fixture = new();
        fixture.PermissionChecker.DeniedPermissions.Add(PermissionKeys.AttendancePolicyManage);

        await Assert.ThrowsAsync<FlowProForbiddenException>(
            () => fixture.Handler.HandleAsync(
                new GetAttendancePolicyHistoryQuery("default"),
                CancellationToken.None));
    }

    private sealed class TestFixture
    {
        public TestFixture()
        {
            PermissionChecker = new FakePermissionChecker();
            Repository = new FakeRepository();
            Handler = new AttendancePolicyWorkflowHandler(
                new FakeRequestContext(),
                PermissionChecker,
                Repository,
                new FakeOutboxWriter(),
                new FakeAuditWriter(),
                new FakeUnitOfWork(),
                new FakeTimeProvider(Now));
        }

        public AttendancePolicyWorkflowHandler Handler { get; }

        public FakePermissionChecker PermissionChecker { get; }

        public FakeRepository Repository { get; }

        public static AttendancePolicyVersion CreateVersion(
            int versionNumber = 1,
            DateTimeOffset? effectiveFrom = null) =>
            new(
                TenantId,
                "default",
                versionNumber,
                """{"id":"default"}""",
                ActorUserId,
                Now,
                effectiveFrom ?? Now);
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

    private sealed class FakeRepository : IAttendancePolicyWorkflowRepository
    {
        public List<AttendancePolicyVersion> Added { get; } = [];

        public AttendancePolicyVersion? Current { get; set; }

        public IReadOnlyList<AttendancePolicyVersion> Versions { get; set; } = [];

        public DateTimeOffset? LastEffectiveQueryAt { get; private set; }

        public Task<AttendancePolicyVersion?> FindCurrentAsync(
            Guid tenantId,
            string policyId,
            CancellationToken cancellationToken) =>
            Task.FromResult(Current);

        public Task<AttendancePolicyVersion?> FindEffectiveAsync(
            Guid tenantId,
            string policyId,
            DateTimeOffset at,
            CancellationToken cancellationToken)
        {
            LastEffectiveQueryAt = at;

            return Task.FromResult(
                Versions
                    .Where(version => version.GovernsAt(at))
                    .OrderByDescending(version => version.EffectiveFrom)
                    .FirstOrDefault());
        }

        public Task<IReadOnlyList<AttendancePolicyVersion>> ListVersionsAsync(
            Guid tenantId,
            string policyId,
            CancellationToken cancellationToken) =>
            Task.FromResult(Versions);

        public Task<int> GetNextVersionNumberAsync(
            Guid tenantId,
            string policyId,
            CancellationToken cancellationToken) =>
            Task.FromResult((Current?.VersionNumber ?? 0) + 1);

        public Task<ClientAggregate?> FindCompatibilityAggregateAsync(
            Guid tenantId,
            string aggregateType,
            CancellationToken cancellationToken) =>
            Task.FromResult<ClientAggregate?>(null);

        public void AddVersion(AttendancePolicyVersion version) => Added.Add(version);

        public void AddCompatibilityAggregate(ClientAggregate aggregate)
        {
        }
    }

    private sealed class FakeOutboxWriter : IOutboxWriter
    {
        public void Add(OutboxMessage message)
        {
        }
    }

    private sealed class FakeAuditWriter : IAuditWriter
    {
        public void Add(AuditEvent auditEvent)
        {
        }
    }

    private sealed class FakeUnitOfWork : IUnitOfWork
    {
        public Task<T> ExecuteAsync<T>(
            Func<CancellationToken, Task<T>> operation,
            CancellationToken cancellationToken) =>
            operation(cancellationToken);
    }

    private sealed class FakeTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
