using FlowPro.Application.Attendance;
using FlowPro.Domain.Attendance;
using FlowPro.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Infrastructure.Attendance;

internal sealed class AttendanceRepository(FlowProDbContext dbContext) : IAttendanceRepository
{
    public async Task AcquireExclusiveLockAsync(string key, CancellationToken cancellationToken)
    {
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock(hashtextextended({key}, 0));",
            cancellationToken);
    }

    public Task<TimeBooking?> FindByClientOperationIdAsync(
        Guid tenantId,
        string clientOperationId,
        CancellationToken cancellationToken) =>
        dbContext.TimeBookings.SingleOrDefaultAsync(
            booking => booking.TenantId == tenantId
                && booking.ClientOperationId == clientOperationId,
            cancellationToken);

    public Task<AttendanceState?> GetStateForUpdateAsync(
        Guid tenantId,
        Guid employeeId,
        CancellationToken cancellationToken) =>
        dbContext.AttendanceStates.SingleOrDefaultAsync(
            state => state.TenantId == tenantId && state.EmployeeId == employeeId,
            cancellationToken);

    public Task<AttendanceState?> GetStateAsync(
        Guid tenantId,
        Guid employeeId,
        CancellationToken cancellationToken) =>
        dbContext.AttendanceStates
            .AsNoTracking()
            .SingleOrDefaultAsync(
                state => state.TenantId == tenantId && state.EmployeeId == employeeId,
                cancellationToken);

    public Task<TimeBooking?> FindByIdForUpdateAsync(
        Guid tenantId,
        Guid bookingId,
        CancellationToken cancellationToken) =>
        dbContext.TimeBookings.SingleOrDefaultAsync(
            booking => booking.TenantId == tenantId && booking.Id == bookingId,
            cancellationToken);

    public async Task<IReadOnlyList<TimeBooking>> ListActiveBookingsForUpdateAsync(
        Guid tenantId,
        Guid employeeId,
        CancellationToken cancellationToken) =>
        await dbContext.TimeBookings
            .Where(booking => booking.TenantId == tenantId
                && booking.EmployeeId == employeeId
                && !booking.IsVoided)
            .OrderBy(booking => booking.OccurredAt)
            .ThenBy(booking => booking.Id)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<TimeBooking>> ListBookingsAsync(
        Guid tenantId,
        Guid employeeId,
        DateTimeOffset fromInclusive,
        DateTimeOffset toExclusive,
        CancellationToken cancellationToken) =>
        await dbContext.TimeBookings
            .AsNoTracking()
            .Where(booking => booking.TenantId == tenantId
                && booking.EmployeeId == employeeId
                && !booking.IsVoided
                && booking.OccurredAt >= fromInclusive
                && booking.OccurredAt < toExclusive)
            .OrderBy(booking => booking.OccurredAt)
            .ThenBy(booking => booking.Id)
            .ToListAsync(cancellationToken);

    public void Add(AttendanceState state) => dbContext.AttendanceStates.Add(state);

    public void Add(TimeBooking booking) => dbContext.TimeBookings.Add(booking);
}
