using System.Text.Json;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Requests;
using FlowPro.Application.Sync;
using FlowPro.Domain.Sync;

namespace FlowPro.Application.Tests.Requests;

public sealed class RequestWorkflowHandlerTests
{
    private static readonly Guid TenantId = Guid.Parse("01975fa8-7590-7000-8000-000000004001");
    private static readonly Guid UserId = Guid.Parse("01975fa8-7590-7000-8000-000000004002");
    private static readonly Guid EmployeeId = UserId;
    private static readonly DateTimeOffset Now = new(2026, 6, 6, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task SubmitCreatesServerBackedRequestAndNotification()
    {
        TestFixture fixture = new();

        RequestWorkflowResult result = await fixture.Handler.HandleAsync(
            CreateSubmitCommand(),
            CancellationToken.None);

        Assert.Equal("request", result.Primary.Aggregate);
        Assert.Equal("submitted", result.Primary.Payload.GetProperty("status").GetString());
        Assert.Contains(result.SideEffects, item => item.Aggregate == "notification");
        Assert.Contains(fixture.Sync.Operations, operation => operation.Type == "request.submit");
        Assert.Contains(fixture.Sync.Operations, operation => operation.Type == "notification.upsert");
    }

    [Fact]
    public async Task ApprovingAbsenceCreatesAbsenceSideEffect()
    {
        TestFixture fixture = new();
        RequestWorkflowResult submitted = await fixture.Handler.HandleAsync(
            CreateSubmitCommand(requestId: "request-vacation-1"),
            CancellationToken.None);
        fixture.Repository.UpsertFromResult(submitted.Primary);

        RequestWorkflowResult approved = await fixture.Handler.HandleAsync(
            new DecideRequestCommand("request-vacation-1", RequestDecision.Approve, "Fine.", null, "approve-op"),
            CancellationToken.None);

        Assert.Equal("approved", approved.Primary.Payload.GetProperty("status").GetString());
        Assert.Contains(approved.SideEffects, item => item.Aggregate == "absence");
        Assert.Contains(fixture.Sync.Operations, operation => operation.Type == "absence.upsert");
    }

    [Fact]
    public async Task MultiStepApprovalRequiresEveryConfiguredApprovalStep()
    {
        Guid managerId = Guid.Parse("01975fa8-7590-7000-8000-000000004003");
        TestFixture fixture = new();
        RequestWorkflowResult submitted = await fixture.Handler.HandleAsync(
            CreateSubmitCommand(
                requestId: "request-vacation-2-step",
                approvalFlow: new RequestApprovalFlow(
                    0,
                    [
                        new RequestApprovalStep(
                            "teamlead",
                            "Team lead",
                            [UserId],
                            ["Marta Lindgren"],
                            false,
                            "pending",
                            []),
                        new RequestApprovalStep(
                            "manager",
                            "Manager",
                            [managerId],
                            ["Manager"],
                            false,
                            "waiting",
                            []),
                    ],
                    false)),
            CancellationToken.None);
        fixture.Repository.UpsertFromResult(submitted.Primary);

        RequestWorkflowResult firstApproval = await fixture.Handler.HandleAsync(
            new DecideRequestCommand("request-vacation-2-step", RequestDecision.Approve, "Looks good.", null, "approve-op-1"),
            CancellationToken.None);

        Assert.Equal("submitted", firstApproval.Primary.Payload.GetProperty("status").GetString());
        Assert.Equal(1, firstApproval.Primary.Payload.GetProperty("approvalFlow").GetProperty("currentStepIndex").GetInt32());
        Assert.DoesNotContain(firstApproval.SideEffects, item => item.Aggregate == "absence");

        fixture.Repository.UpsertFromResult(firstApproval.Primary);
        fixture.Context.CurrentUserId = managerId;
        RequestWorkflowResult finalApproval = await fixture.Handler.HandleAsync(
            new DecideRequestCommand("request-vacation-2-step", RequestDecision.Approve, "Approved.", null, "approve-op-2"),
            CancellationToken.None);

        Assert.Equal("approved", finalApproval.Primary.Payload.GetProperty("status").GetString());
        Assert.Contains(finalApproval.SideEffects, item => item.Aggregate == "absence");
    }

    [Fact]
    public async Task RejectingRequestDoesNotCreateAbsenceSideEffect()
    {
        TestFixture fixture = new();
        RequestWorkflowResult submitted = await fixture.Handler.HandleAsync(
            CreateSubmitCommand(requestId: "request-vacation-reject"),
            CancellationToken.None);
        fixture.Repository.UpsertFromResult(submitted.Primary);

        RequestWorkflowResult rejected = await fixture.Handler.HandleAsync(
            new DecideRequestCommand("request-vacation-reject", RequestDecision.Reject, "No capacity.", null, "reject-op"),
            CancellationToken.None);

        Assert.Equal("rejected", rejected.Primary.Payload.GetProperty("status").GetString());
        Assert.DoesNotContain(rejected.SideEffects, item => item.Aggregate == "absence");
    }

    [Fact]
    public async Task AdjustAndApproveCancelsOriginalAndApprovesAdjustedRequest()
    {
        TestFixture fixture = new();
        RequestWorkflowResult submitted = await fixture.Handler.HandleAsync(
            CreateSubmitCommand(requestId: "request-vacation-adjust-original"),
            CancellationToken.None);
        fixture.Repository.UpsertFromResult(submitted.Primary);

        RequestWorkflowResult adjusted = await fixture.Handler.HandleAsync(
            new AdjustAndApproveRequestCommand(
                "request-vacation-adjust-original",
                CreateSubmitCommand(
                    requestId: "request-vacation-adjusted",
                    statusTypeId: "status-home-office"),
                "Adjusted to home office.",
                null,
                "adjust-approve-op"),
            CancellationToken.None);

        Assert.Equal("request-vacation-adjusted", adjusted.Primary.AggregateId);
        Assert.Equal("approved", adjusted.Primary.Payload.GetProperty("status").GetString());
        Assert.Contains(adjusted.SideEffects, item =>
            item.Aggregate == "request"
            && item.AggregateId == "request-vacation-adjust-original"
            && item.Payload.GetProperty("status").GetString() == "cancelled");
        Assert.Contains(adjusted.SideEffects, item => item.Aggregate == "absence");
        Assert.Contains(fixture.Sync.Operations, operation =>
            operation.Type == "request.cancel"
            && operation.AggregateId == "request-vacation-adjust-original");
        Assert.Contains(fixture.Sync.Operations, operation =>
            operation.Type == "request.approve"
            && operation.AggregateId == "request-vacation-adjusted");
    }

    [Fact]
    public async Task AdjustAndApproveRejectsAlreadyDecidedOriginalRequest()
    {
        TestFixture fixture = new();
        RequestWorkflowResult submitted = await fixture.Handler.HandleAsync(
            CreateSubmitCommand(requestId: "request-vacation-adjust-conflict"),
            CancellationToken.None);
        fixture.Repository.UpsertFromResult(submitted.Primary);
        RequestWorkflowResult approved = await fixture.Handler.HandleAsync(
            new DecideRequestCommand("request-vacation-adjust-conflict", RequestDecision.Approve, null, null, null),
            CancellationToken.None);
        fixture.Repository.UpsertFromResult(approved.Primary);

        FlowProConflictException exception = await Assert.ThrowsAsync<FlowProConflictException>(
            () => fixture.Handler.HandleAsync(
                new AdjustAndApproveRequestCommand(
                    "request-vacation-adjust-conflict",
                    CreateSubmitCommand(requestId: "request-vacation-adjust-conflict-new"),
                    null,
                    null,
                    null),
                CancellationToken.None));

        Assert.Equal("request.not-submitted", exception.Code);
    }

    [Fact]
    public async Task RejectsEmptyBookingCorrection()
    {
        TestFixture fixture = new();

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.Handler.HandleAsync(
                CreateSubmitCommand(kind: "booking-correction", statusTypeId: null, clockIn: null, clockOut: null),
                CancellationToken.None));

        Assert.Equal("request.booking-correction.empty", exception.Code);
    }

    [Fact]
    public async Task PayrollExportCreatesExportAndNotification()
    {
        TestFixture fixture = new();

        RequestWorkflowResult result = await fixture.Handler.HandleAsync(
            new CreatePayrollExportCommand("2026-06", "DATEV", "company", null, null),
            CancellationToken.None);

        Assert.Equal("payroll-export", result.Primary.Aggregate);
        Assert.Equal("DATEV", result.Primary.Payload.GetProperty("format").GetString());
        Assert.Contains(result.SideEffects, item => item.Aggregate == "notification");
        Assert.Contains(fixture.Sync.Operations, operation => operation.Type == "payroll-export.upsert");
    }

    private static SubmitRequestCommand CreateSubmitCommand(
        string requestId = "request-test-1",
        string kind = "absence",
        string? statusTypeId = "status-vacation",
        string? clockIn = null,
        string? clockOut = null,
        RequestApprovalFlow? approvalFlow = null) =>
        new(
            requestId,
            kind,
            EmployeeId,
            "Marta Lindgren",
            new DateOnly(2026, 6, 15),
            new DateOnly(2026, 6, 16),
            kind == "absence" ? "Vacation" : "Booking correction",
            statusTypeId,
            "VAC",
            "Vacation",
            clockIn,
            clockOut,
            null,
            new RequestPartialDay("full-day", null, null),
            null,
            [],
            "Summer break",
            approvalFlow,
            null,
            null);

    private sealed class TestFixture
    {
        public TestFixture()
        {
            Context = new FakeRequestContext();
            Repository = new FakeSyncAggregateRepository();
            Sync = new FakeSyncCommandHandler();
            Handler = new RequestWorkflowHandler(
                Context,
                new FakeIdentitySessionRepository(Context),
                Sync,
                Repository,
                new FixedTimeProvider());
        }

        public RequestWorkflowHandler Handler { get; }

        public FakeRequestContext Context { get; }

        public FakeSyncAggregateRepository Repository { get; }

        public FakeSyncCommandHandler Sync { get; }
    }

    private sealed class FakeRequestContext : ICurrentRequestContext
    {
        public Guid CurrentUserId { get; set; } = RequestWorkflowHandlerTests.UserId;

        public RequestIdentity GetRequiredIdentity() => new(TenantId, CurrentUserId);

        public RequestIdentity? TryGetIdentity() => GetRequiredIdentity();
    }

    private sealed class FakeIdentitySessionRepository(FakeRequestContext context) : IIdentitySessionRepository
    {
        public Task<CurrentSession?> GetCurrentSessionAsync(
            Guid tenantId,
            Guid userId,
            CancellationToken cancellationToken) =>
            Task.FromResult<CurrentSession?>(
                new CurrentSession(
                    tenantId,
                    "flowpro-demo",
                    "FlowPro Demo",
                    context.CurrentUserId,
                    context.CurrentUserId.ToString(),
                    "founder@flowpro.local",
                    "Marta Lindgren",
                    ["superadmin"],
                    PermissionKeys.All,
                    []));
    }

    private sealed class FakeSyncCommandHandler : ICommandHandler<SubmitSyncBatchCommand, SyncBatchResponse>
    {
        public List<ClientSyncOperation> Operations { get; } = [];

        public Task<SyncBatchResponse> HandleAsync(
            SubmitSyncBatchCommand command,
            CancellationToken cancellationToken)
        {
            Operations.AddRange(command.Operations);
            DateTimeOffset now = Now;
            return Task.FromResult(
                new SyncBatchResponse(
                    command.Operations
                        .Select(operation => new SyncAcceptedOperation(operation.Id, "v1", now))
                        .ToArray(),
                    [],
                    [],
                    now));
        }
    }

    private sealed class FakeSyncAggregateRepository : ISyncAggregateRepository
    {
        private readonly List<ClientAggregate> aggregates = [];

        public Task<ClientAggregate?> FindAsync(
            Guid tenantId,
            string aggregateType,
            string aggregateId,
            CancellationToken cancellationToken) =>
            Task.FromResult(
                aggregates.SingleOrDefault(aggregate =>
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
                aggregates
                    .Where(aggregate => aggregate.TenantId == tenantId
                        && aggregate.AggregateType == aggregateType
                        && (includeDeleted || !aggregate.IsDeleted)
                        && (!ownerOnly || ownerUserId is null || aggregate.OwnerUserId is null || aggregate.OwnerUserId == ownerUserId))
                    .Skip(offset)
                    .Take(limit)
                    .ToArray());

        public void Add(ClientAggregate aggregate) => aggregates.Add(aggregate);

        public void UpsertFromResult(ClientAggregateItem item)
        {
            aggregates.RemoveAll(aggregate =>
                aggregate.TenantId == TenantId
                && aggregate.AggregateType == item.Aggregate
                && aggregate.AggregateId == item.AggregateId);

            aggregates.Add(
                new ClientAggregate(
                    TenantId,
                    item.Aggregate,
                    item.AggregateId,
                    item.Payload.GetRawText(),
                    "seed-op",
                    Now,
                    item.OwnerUserId));
        }
    }

    private sealed class FixedTimeProvider : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => Now;
    }
}
