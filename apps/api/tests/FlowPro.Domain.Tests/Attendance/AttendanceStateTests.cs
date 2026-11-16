using FlowPro.Domain.Attendance;
using FlowPro.Domain.Common;

namespace FlowPro.Domain.Tests.Attendance;

public sealed class AttendanceStateTests
{
    private static readonly Guid TenantId = Guid.Parse("01975fa8-7590-7000-8000-000000000101");
    private static readonly Guid EmployeeId = Guid.Parse("01975fa8-7590-7000-8000-000000000102");

    [Fact]
    public void Valid_workday_transitions_are_applied_in_order()
    {
        AttendanceState state = AttendanceState.Create(TenantId, EmployeeId);
        DateTimeOffset clockIn = new(2026, 6, 4, 6, 0, 0, TimeSpan.Zero);

        state.Apply(TimeBookingType.ClockIn, clockIn, WorkLocation.HomeOffice);
        state.Apply(TimeBookingType.StartBreak, clockIn.AddHours(4), null);
        state.Apply(TimeBookingType.ResumeWork, clockIn.AddHours(4.5), null);
        state.Apply(TimeBookingType.ClockOut, clockIn.AddHours(8.5), null);

        Assert.Equal(WorkState.Finished, state.State);
        Assert.Equal(WorkLocation.HomeOffice, state.CurrentLocation);
        Assert.Equal(clockIn.AddHours(8.5), state.FinishedAt);
        Assert.Equal(4, state.Version);
    }

    [Fact]
    public void Duplicate_clock_in_is_rejected()
    {
        AttendanceState state = AttendanceState.Create(TenantId, EmployeeId);
        DateTimeOffset clockIn = new(2026, 6, 4, 6, 0, 0, TimeSpan.Zero);
        state.Apply(TimeBookingType.ClockIn, clockIn, WorkLocation.Office);

        DomainRuleException exception = Assert.Throws<DomainRuleException>(
            () => state.Apply(TimeBookingType.ClockIn, clockIn.AddMinutes(1), WorkLocation.Office));

        Assert.Equal("attendance.clock-in.invalid-state", exception.Code);
    }

    [Fact]
    public void Booking_before_latest_event_is_rejected()
    {
        AttendanceState state = AttendanceState.Create(TenantId, EmployeeId);
        DateTimeOffset clockIn = new(2026, 6, 4, 6, 0, 0, TimeSpan.Zero);
        state.Apply(TimeBookingType.ClockIn, clockIn, WorkLocation.Office);

        DomainRuleException exception = Assert.Throws<DomainRuleException>(
            () => state.Apply(TimeBookingType.StartBreak, clockIn.AddMinutes(-1), null));

        Assert.Equal("attendance.event-before-current-state", exception.Code);
    }

    [Fact]
    public void New_session_can_start_after_clock_out()
    {
        AttendanceState state = AttendanceState.Create(TenantId, EmployeeId);
        DateTimeOffset firstClockIn = new(2026, 6, 4, 6, 0, 0, TimeSpan.Zero);
        state.Apply(TimeBookingType.ClockIn, firstClockIn, WorkLocation.Office);
        state.Apply(TimeBookingType.ClockOut, firstClockIn.AddHours(2), null);

        DateTimeOffset secondClockIn = firstClockIn.AddHours(3);
        state.Apply(TimeBookingType.ClockIn, secondClockIn, WorkLocation.HomeOffice);

        Assert.Equal(WorkState.Working, state.State);
        Assert.Equal(secondClockIn, state.StartedAt);
        Assert.Null(state.FinishedAt);
        Assert.Equal(WorkLocation.HomeOffice, state.CurrentLocation);
    }

    [Fact]
    public void RebuildReplacesStateFromActiveBookings()
    {
        AttendanceState state = AttendanceState.Create(TenantId, EmployeeId);
        DateTimeOffset originalStart = new(2026, 6, 4, 6, 0, 0, TimeSpan.Zero);
        state.Apply(TimeBookingType.ClockIn, originalStart, WorkLocation.Office);
        TimeBooking replacement = TimeBooking.Create(
            TenantId,
            EmployeeId,
            TimeBookingType.ClockIn,
            originalStart.AddMinutes(15),
            originalStart.AddMinutes(20),
            WorkLocation.HomeOffice,
            BookingSource.Manual,
            "rebuild-1");

        state.Rebuild([replacement]);

        Assert.Equal(WorkState.Working, state.State);
        Assert.Equal(originalStart.AddMinutes(15), state.StartedAt);
        Assert.Equal(WorkLocation.HomeOffice, state.CurrentLocation);
    }
}
