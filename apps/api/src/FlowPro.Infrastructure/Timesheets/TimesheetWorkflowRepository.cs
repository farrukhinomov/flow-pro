using FlowPro.Application.Timesheets;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Timesheets;
using FlowPro.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Infrastructure.Timesheets;

internal sealed class TimesheetWorkflowRepository(FlowProDbContext dbContext)
    : ITimesheetWorkflowRepository
{
    public Task<Membership?> FindUserAsync(
        Guid tenantId,
        string externalId,
        CancellationToken cancellationToken) =>
        dbContext.Users.SingleOrDefaultAsync(
            user => user.TenantId == tenantId
                && user.ExternalSubject == externalId,
            cancellationToken);

    public Task<Membership?> FindUserByIdAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken) =>
        dbContext.Users.SingleOrDefaultAsync(
            user => user.TenantId == tenantId && user.Id == userId,
            cancellationToken);

    public Task<MonthlyTimesheetSnapshot?> FindSnapshotAsync(
        Guid tenantId,
        string employeeExternalId,
        string periodMonth,
        CancellationToken cancellationToken) =>
        dbContext.MonthlyTimesheetSnapshots.SingleOrDefaultAsync(
            snapshot => snapshot.TenantId == tenantId
                && snapshot.EmployeeExternalId == employeeExternalId
                && snapshot.PeriodMonth == periodMonth,
            cancellationToken);

    public void AddSnapshot(MonthlyTimesheetSnapshot snapshot) =>
        dbContext.MonthlyTimesheetSnapshots.Add(snapshot);
}
