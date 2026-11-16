using FlowPro.Domain.Common;

namespace FlowPro.Domain.Attendance;

public sealed class AttendanceState : ITrackedEntity
{
    private AttendanceState()
    {
    }

    private AttendanceState(Guid tenantId, Guid employeeId)
    {
        TenantId = tenantId;
        EmployeeId = employeeId;
        State = WorkState.NotWorking;
    }

    public Guid TenantId { get; private set; }

    public Guid EmployeeId { get; private set; }

    public WorkState State { get; private set; }

    public WorkLocation? CurrentLocation { get; private set; }

    public DateTimeOffset? StartedAt { get; private set; }

    public DateTimeOffset? BreakStartedAt { get; private set; }

    public DateTimeOffset? FinishedAt { get; private set; }

    public DateTimeOffset? LastEventAt { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public long Version { get; private set; }

    public static AttendanceState Create(Guid tenantId, Guid employeeId) => new(tenantId, employeeId);

    public void Apply(TimeBookingType type, DateTimeOffset occurredAt, WorkLocation? location)
    {
        if (LastEventAt is not null && occurredAt < LastEventAt)
        {
            throw new DomainRuleException(
                "attendance.event-before-current-state",
                "The booking cannot occur before the employee's latest booking.");
        }

        switch (type)
        {
            case TimeBookingType.ClockIn:
                ClockIn(occurredAt, location ?? WorkLocation.Office);
                break;
            case TimeBookingType.StartBreak:
                StartBreak(occurredAt);
                break;
            case TimeBookingType.ResumeWork:
                ResumeWork();
                break;
            case TimeBookingType.ClockOut:
                ClockOut(occurredAt);
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(type), type, null);
        }

        LastEventAt = occurredAt;
        Version++;
    }

    public void Rebuild(IEnumerable<TimeBooking> activeBookings)
    {
        AttendanceState rebuilt = Create(TenantId, EmployeeId);

        foreach (TimeBooking booking in activeBookings
                     .Where(booking => !booking.IsVoided)
                     .OrderBy(booking => booking.OccurredAt)
                     .ThenBy(booking => booking.Id))
        {
            rebuilt.Apply(booking.Type, booking.OccurredAt, booking.Location);
        }

        State = rebuilt.State;
        CurrentLocation = rebuilt.CurrentLocation;
        StartedAt = rebuilt.StartedAt;
        BreakStartedAt = rebuilt.BreakStartedAt;
        FinishedAt = rebuilt.FinishedAt;
        LastEventAt = rebuilt.LastEventAt;
        Version++;
    }

    private void ClockIn(DateTimeOffset occurredAt, WorkLocation location)
    {
        if (State is not WorkState.NotWorking and not WorkState.Finished)
        {
            throw InvalidTransition("clock-in");
        }

        State = WorkState.Working;
        CurrentLocation = location;
        StartedAt = occurredAt;
        BreakStartedAt = null;
        FinishedAt = null;
    }

    private void StartBreak(DateTimeOffset occurredAt)
    {
        if (State != WorkState.Working)
        {
            throw InvalidTransition("start-break");
        }

        State = WorkState.Break;
        BreakStartedAt = occurredAt;
    }

    private void ResumeWork()
    {
        if (State != WorkState.Break)
        {
            throw InvalidTransition("resume-work");
        }

        State = WorkState.Working;
        BreakStartedAt = null;
    }

    private void ClockOut(DateTimeOffset occurredAt)
    {
        if (State != WorkState.Working)
        {
            throw InvalidTransition("clock-out");
        }

        State = WorkState.Finished;
        BreakStartedAt = null;
        FinishedAt = occurredAt;
    }

    private DomainRuleException InvalidTransition(string command) =>
        new(
            $"attendance.{command}.invalid-state",
            $"Cannot execute {command} while attendance state is {State}.");
}
