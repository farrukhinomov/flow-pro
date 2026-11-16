using FlowPro.Application.Audit;
using FlowPro.Domain.Audit;
using FlowPro.Infrastructure.Persistence;

namespace FlowPro.Infrastructure.Audit;

internal sealed class AuditWriter(FlowProDbContext dbContext) : IAuditWriter
{
    public void Add(AuditEvent auditEvent) => dbContext.AuditEvents.Add(auditEvent);
}
