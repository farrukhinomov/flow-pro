namespace FlowPro.Domain.Audit;

public sealed class AuditEvent
{
    private AuditEvent()
    {
    }

    public AuditEvent(
        Guid tenantId,
        Guid actorUserId,
        string action,
        string aggregateType,
        Guid aggregateId,
        string detailsJson,
        DateTimeOffset occurredAt)
    {
        Id = Guid.CreateVersion7();
        TenantId = tenantId;
        ActorUserId = actorUserId;
        Action = action;
        AggregateType = aggregateType;
        AggregateId = aggregateId;
        DetailsJson = detailsJson;
        OccurredAt = occurredAt;
    }

    public Guid Id { get; private set; }

    public long Sequence { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid ActorUserId { get; private set; }

    public string Action { get; private set; } = string.Empty;

    public string AggregateType { get; private set; } = string.Empty;

    public Guid AggregateId { get; private set; }

    public string DetailsJson { get; private set; } = string.Empty;

    public DateTimeOffset OccurredAt { get; private set; }
}
