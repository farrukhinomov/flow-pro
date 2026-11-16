namespace FlowPro.Application.Planning;

public interface IPlanningWorkflowRepository
{
    Task<PlanningWorkflowSnapshot> GetSnapshotAsync(
        Guid tenantId,
        string periodMonth,
        CancellationToken cancellationToken);
}
