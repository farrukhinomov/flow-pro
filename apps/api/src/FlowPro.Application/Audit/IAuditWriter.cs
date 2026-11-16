using FlowPro.Domain.Audit;

namespace FlowPro.Application.Audit;

public interface IAuditWriter
{
    void Add(AuditEvent auditEvent);
}
