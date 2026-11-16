using FlowPro.Domain.Attendance;

namespace FlowPro.Application.Attendance;

public interface IAttendanceRepository
{
    Task AcquireExclusiveLockAsync(string key, CancellationToken cancellationToken);

    Task<TimeBooking?> FindByClientOperationIdAsync(
        Guid tenantId,
        string clientOperationId,
        CancellationToken cancellationToken);

    Task<AttendanceState?> GetStateForUpdateAsync(
        Guid tenantId,
        Guid employeeId,
        CancellationToken cancellationToken);

    Task<AttendanceState?> GetStateAsync(
        Guid tenantId,
        Guid employeeId,
        CancellationToken cancellationToken);

    Task<TimeBooking?> FindByIdForUpdateAsync(
        Guid tenantId,
        Guid bookingId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<TimeBooking>> ListActiveBookingsForUpdateAsync(
        Guid tenantId,
        Guid employeeId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<TimeBooking>> ListBookingsAsync(
        Guid tenantId,
        Guid employeeId,
        DateTimeOffset fromInclusive,
        DateTimeOffset toExclusive,
        CancellationToken cancellationToken);

    void Add(AttendanceState state);

    void Add(TimeBooking booking);
}
