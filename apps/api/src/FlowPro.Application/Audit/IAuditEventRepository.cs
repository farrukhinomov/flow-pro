using FlowPro.Domain.Audit;

namespace FlowPro.Application.Audit;

public interface IAuditEventRepository
{
    Task<IReadOnlyList<AuditEvent>> ListAsync(
        Guid tenantId,
        AuditEventFilter? filter,
        int offset,
        int limit,
        CancellationToken cancellationToken);
}
