namespace FlowPro.Application.Reports;

public interface IReportWorkflowRepository
{
    Task<ReportWorkflowSnapshot> GetSnapshotAsync(
        Guid tenantId,
        string periodMonth,
        CancellationToken cancellationToken);
}
