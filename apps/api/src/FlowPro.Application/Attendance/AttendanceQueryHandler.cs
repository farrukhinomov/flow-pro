using FlowPro.Application.Common;
using FlowPro.Application.Organization;
using FlowPro.Domain.Attendance;
using FlowPro.Domain.Organization;

namespace FlowPro.Application.Attendance;

public sealed class AttendanceQueryHandler(
    ICurrentRequestContext requestContext,
    IEmployeeDirectory employeeDirectory,
    IAttendanceRepository attendanceRepository) :
    IQueryHandler<GetCurrentAttendanceStatusQuery, AttendanceStatus>,
    IQueryHandler<ListAttendanceEventsQuery, AttendanceEventPage>
{
    public async Task<AttendanceStatus> HandleAsync(
        GetCurrentAttendanceStatusQuery query,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        Employee employee = await GetCurrentEmployeeAsync(identity, cancellationToken);
        AttendanceState? state = await attendanceRepository.GetStateAsync(
            identity.TenantId,
            employee.Id,
            cancellationToken);

        return state is null
            ? new AttendanceStatus(
                employee.Id,
                WorkState.NotWorking,
                null,
                null,
                null,
                null,
                null,
                0)
            : AttendanceMappings.MapStatus(state);
    }

    public async Task<AttendanceEventPage> HandleAsync(
        ListAttendanceEventsQuery query,
        CancellationToken cancellationToken)
    {
        if (query.ToExclusive <= query.FromInclusive)
        {
            throw new FlowProValidationException(
                "attendance.invalid-range",
                "The end of the range must be after the beginning.");
        }

        if (query.ToExclusive - query.FromInclusive > TimeSpan.FromDays(93))
        {
            throw new FlowProValidationException(
                "attendance.range-too-large",
                "A single attendance query cannot exceed 93 days.");
        }

        RequestIdentity identity = requestContext.GetRequiredIdentity();
        Employee employee = await GetCurrentEmployeeAsync(identity, cancellationToken);
        IReadOnlyList<TimeBooking> bookings = await attendanceRepository.ListBookingsAsync(
            identity.TenantId,
            employee.Id,
            query.FromInclusive,
            query.ToExclusive,
            cancellationToken);

        return new AttendanceEventPage(bookings.Select(AttendanceMappings.MapBooking).ToArray());
    }

    private async Task<Employee> GetCurrentEmployeeAsync(
        RequestIdentity identity,
        CancellationToken cancellationToken) =>
        await employeeDirectory.FindActiveByUserIdAsync(
            identity.TenantId,
            identity.UserId,
            cancellationToken)
        ?? throw new FlowProForbiddenException(
            "employee.not-active",
            "The current user is not linked to an active employee.");
}

internal static class AttendanceMappings
{
    public static AttendanceStatus MapStatus(AttendanceState state) =>
        new(
            state.EmployeeId,
            state.State,
            state.CurrentLocation,
            state.StartedAt,
            state.BreakStartedAt,
            state.FinishedAt,
            state.LastEventAt,
            state.Version);

    public static TimeBookingRecord MapBooking(TimeBooking booking) =>
        new(
            booking.Id,
            booking.EmployeeId,
            booking.Type,
            booking.OccurredAt,
            booking.ReceivedAt,
            booking.Location,
            booking.Source,
            booking.SupersedesBookingId,
            booking.CorrectionReason,
            booking.DeviceId,
            booking.DeviceSequence,
            booking.Latitude,
            booking.Longitude,
            booking.AccuracyMeters,
            booking.IsVoided);
}
