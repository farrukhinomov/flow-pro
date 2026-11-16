using FlowPro.Domain.Identity;
using FlowPro.Domain.Timesheets;

namespace FlowPro.Application.Timesheets;

public interface ITimesheetWorkflowRepository
{
    Task<Membership?> FindUserAsync(
        Guid tenantId,
        string externalId,
        CancellationToken cancellationToken);

    Task<Membership?> FindUserByIdAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken);

    Task<MonthlyTimesheetSnapshot?> FindSnapshotAsync(
        Guid tenantId,
        string employeeExternalId,
        string periodMonth,
        CancellationToken cancellationToken);

    void AddSnapshot(MonthlyTimesheetSnapshot snapshot);
}
