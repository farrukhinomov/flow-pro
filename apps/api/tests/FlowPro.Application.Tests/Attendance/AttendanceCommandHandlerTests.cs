using FlowPro.Application.Attendance;
using FlowPro.Application.Audit;
using FlowPro.Application.Common;
using FlowPro.Application.Integration;
using FlowPro.Application.Organization;
using FlowPro.Domain.Attendance;
using FlowPro.Domain.Audit;
using FlowPro.Domain.Integration;
using FlowPro.Domain.Organization;

namespace FlowPro.Application.Tests.Attendance;

public sealed class AttendanceCommandHandlerTests
{
    private static readonly Guid TenantId = Guid.Parse("01975fa8-7590-7000-8000-000000000201");
    private static readonly Guid UserId = Guid.Parse("01975fa8-7590-7000-8000-000000000202");
    private static readonly Guid EmployeeId = Guid.Parse("01975fa8-7590-7000-8000-000000000203");
    private static readonly DateTimeOffset Now = new(2026, 6, 4, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task ClockInCreatesBookingStateAuditAndOutboxInOneUseCase()
    {
        TestFixture fixture = new();

        AttendanceCommandResult result = await fixture.Handler.HandleAsync(
            new ExecuteAttendanceCommand(
                TimeBookingType.ClockIn,
                WorkLocation.HomeOffice,
                "command-1"),
            CancellationToken.None);

        Assert.False(result.IsReplay);
        Assert.Equal(WorkState.Working, result.Status.State);
        Assert.Equal(WorkLocation.HomeOffice, result.Status.Location);
        Assert.Single(fixture.Repository.Bookings);
        Assert.Single(fixture.AuditWriter.Events);
        Assert.Single(fixture.Outbox.Messages);
        Assert.Equal(2, fixture.Repository.AcquiredLocks.Count);
    }

    [Fact]
    public async Task RetriedCommandReturnsExistingBookingWithoutCreatingNewRecords()
    {
        TestFixture fixture = new();
        ExecuteAttendanceCommand command = new(
            TimeBookingType.ClockIn,
            WorkLocation.Office,
            "command-2");

        AttendanceCommandResult first = await fixture.Handler.HandleAsync(
            command,
            CancellationToken.None);
        AttendanceCommandResult replay = await fixture.Handler.HandleAsync(
            command,
            CancellationToken.None);

        Assert.True(replay.IsReplay);
        Assert.Equal(first.Booking.Id, replay.Booking.Id);
        Assert.Single(fixture.Repository.Bookings);
        Assert.Single(fixture.AuditWriter.Events);
        Assert.Single(fixture.Outbox.Messages);
    }

    [Fact]
    public async Task ReusingIdempotencyKeyForAnotherCommandIsRejected()
    {
        TestFixture fixture = new();
        await fixture.Handler.HandleAsync(
            new ExecuteAttendanceCommand(TimeBookingType.ClockIn, WorkLocation.Office, "command-3"),
            CancellationToken.None);

        FlowProConflictException exception = await Assert.ThrowsAsync<FlowProConflictException>(
            () => fixture.Handler.HandleAsync(
                new ExecuteAttendanceCommand(TimeBookingType.StartBreak, null, "command-3"),
                CancellationToken.None));

        Assert.Equal("idempotency-key.reused", exception.Code);
        Assert.Single(fixture.Repository.Bookings);
    }

    [Fact]
    public async Task IdempotencyKeyIsNormalizedBeforeLockingAndPersistence()
    {
        TestFixture fixture = new();

        await fixture.Handler.HandleAsync(
            new ExecuteAttendanceCommand(TimeBookingType.ClockIn, WorkLocation.Office, " command-4 "),
            CancellationToken.None);
        AttendanceCommandResult replay = await fixture.Handler.HandleAsync(
            new ExecuteAttendanceCommand(TimeBookingType.ClockIn, WorkLocation.Office, "command-4"),
            CancellationToken.None);

        Assert.True(replay.IsReplay);
        Assert.Equal("command-4", Assert.Single(fixture.Repository.Bookings).ClientOperationId);
        Assert.Contains(
            $"operation:{TenantId}:command-4",
            fixture.Repository.AcquiredLocks);
    }

    [Fact]
    public async Task CorrectionVoidsOriginalAndCreatesSupersedingBooking()
    {
        TestFixture fixture = new();
        AttendanceCommandResult original = await fixture.Handler.HandleAsync(
            new ExecuteAttendanceCommand(TimeBookingType.ClockIn, WorkLocation.Office, "command-5"),
            CancellationToken.None);

        AttendanceCommandResult corrected = await fixture.Handler.HandleAsync(
            new CorrectTimeBookingCommand(
                original.Booking.Id,
                TimeBookingType.ClockIn,
                Now.AddMinutes(-10),
                WorkLocation.HomeOffice,
                "Corrected start time.",
                "command-6"),
            CancellationToken.None);

        Assert.True(Assert.Single(fixture.Repository.Bookings, booking => booking.Id == original.Booking.Id).IsVoided);
        Assert.Equal(original.Booking.Id, corrected.Booking.SupersedesBookingId);
        Assert.Equal(WorkLocation.HomeOffice, corrected.Status.Location);
        Assert.Equal(2, fixture.Repository.Bookings.Count);
        Assert.Equal(2, fixture.AuditWriter.Events.Count);
        Assert.Equal(2, fixture.Outbox.Messages.Count);
    }

    [Fact]
    public async Task VoidPreservesBookingAndRebuildsState()
    {
        TestFixture fixture = new();
        AttendanceCommandResult original = await fixture.Handler.HandleAsync(
            new ExecuteAttendanceCommand(TimeBookingType.ClockIn, WorkLocation.Office, "command-7"),
            CancellationToken.None);

        VoidTimeBookingResult result = await fixture.Handler.HandleAsync(
            new VoidTimeBookingCommand(original.Booking.Id, "Accidental booking.", "command-8"),
            CancellationToken.None);

        Assert.True(result.Booking.IsVoided);
        Assert.Equal(WorkState.NotWorking, result.Status.State);
        Assert.Single(fixture.Repository.Bookings);
        Assert.True(fixture.Repository.Bookings[0].IsVoided);
    }

    private sealed class TestFixture
    {
        public TestFixture()
        {
            Employee employee = new(
                TenantId,
                UserId,
                "TEST-1",
                "Test",
                "Employee",
                EmployeeId);
            Repository = new FakeAttendanceRepository();
            AuditWriter = new FakeAuditWriter();
            Outbox = new FakeOutbox();
            Handler = new AttendanceCommandHandler(
                new FakeRequestContext(),
                new FakeEmployeeDirectory(employee),
                Repository,
                AuditWriter,
                Outbox,
                new FakeUnitOfWork(),
                new FixedTimeProvider());
        }

        public AttendanceCommandHandler Handler { get; }

        public FakeAttendanceRepository Repository { get; }

        public FakeAuditWriter AuditWriter { get; }

        public FakeOutbox Outbox { get; }
    }

    private sealed class FakeRequestContext : ICurrentRequestContext
    {
        public RequestIdentity GetRequiredIdentity() => new(TenantId, UserId);

        public RequestIdentity? TryGetIdentity() => GetRequiredIdentity();
    }

    private sealed class FakeEmployeeDirectory(Employee employee) : IEmployeeDirectory
    {
        public Task<Employee?> FindActiveByUserIdAsync(
            Guid tenantId,
            Guid userId,
            CancellationToken cancellationToken) =>
            Task.FromResult<Employee?>(employee);
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

    private sealed class FakeAttendanceRepository : IAttendanceRepository
    {
        public List<string> AcquiredLocks { get; } = [];

        public List<TimeBooking> Bookings { get; } = [];

        public AttendanceState? State { get; private set; }

        public Task AcquireExclusiveLockAsync(string key, CancellationToken cancellationToken)
        {
            AcquiredLocks.Add(key);
            return Task.CompletedTask;
        }

        public Task<TimeBooking?> FindByClientOperationIdAsync(
            Guid tenantId,
            string clientOperationId,
            CancellationToken cancellationToken) =>
            Task.FromResult(Bookings.SingleOrDefault(
                booking => booking.TenantId == tenantId
                    && booking.ClientOperationId == clientOperationId));

        public Task<AttendanceState?> GetStateForUpdateAsync(
            Guid tenantId,
            Guid employeeId,
            CancellationToken cancellationToken) =>
            Task.FromResult(State);

        public Task<AttendanceState?> GetStateAsync(
            Guid tenantId,
            Guid employeeId,
            CancellationToken cancellationToken) =>
            Task.FromResult(State);

        public Task<TimeBooking?> FindByIdForUpdateAsync(
            Guid tenantId,
            Guid bookingId,
            CancellationToken cancellationToken) =>
            Task.FromResult(Bookings.SingleOrDefault(
                booking => booking.TenantId == tenantId && booking.Id == bookingId));

        public Task<IReadOnlyList<TimeBooking>> ListActiveBookingsForUpdateAsync(
            Guid tenantId,
            Guid employeeId,
            CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<TimeBooking>>(
                Bookings.Where(booking => booking.TenantId == tenantId
                        && booking.EmployeeId == employeeId
                        && !booking.IsVoided)
                    .ToArray());

        public Task<IReadOnlyList<TimeBooking>> ListBookingsAsync(
            Guid tenantId,
            Guid employeeId,
            DateTimeOffset fromInclusive,
            DateTimeOffset toExclusive,
            CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<TimeBooking>>(
                Bookings.Where(booking => !booking.IsVoided
                        && booking.OccurredAt >= fromInclusive
                        && booking.OccurredAt < toExclusive)
                    .ToArray());

        public void Add(AttendanceState state) => State = state;

        public void Add(TimeBooking booking) => Bookings.Add(booking);
    }

    private sealed class FakeAuditWriter : IAuditWriter
    {
        public List<AuditEvent> Events { get; } = [];

        public void Add(AuditEvent auditEvent) => Events.Add(auditEvent);
    }

    private sealed class FakeOutbox : IOutboxWriter
    {
        public List<OutboxMessage> Messages { get; } = [];

        public void Add(OutboxMessage message) => Messages.Add(message);
    }
}
