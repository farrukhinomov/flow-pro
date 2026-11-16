namespace FlowPro.Domain.Integration;

public sealed class OutboxMessage
{
    private OutboxMessage()
    {
    }

    public OutboxMessage(
        Guid tenantId,
        string eventType,
        string aggregateType,
        Guid aggregateId,
        string payloadJson,
        DateTimeOffset occurredAt)
    {
        Id = Guid.CreateVersion7();
        TenantId = tenantId;
        EventType = eventType;
        AggregateType = aggregateType;
        AggregateId = aggregateId;
        PayloadJson = payloadJson;
        OccurredAt = occurredAt;
    }

    public Guid Id { get; private set; }

    public long Sequence { get; private set; }

    public Guid TenantId { get; private set; }

    public string EventType { get; private set; } = string.Empty;

    public string AggregateType { get; private set; } = string.Empty;

    public Guid AggregateId { get; private set; }

    public string PayloadJson { get; private set; } = string.Empty;

    public DateTimeOffset OccurredAt { get; private set; }

    public DateTimeOffset? ProcessedAt { get; private set; }

    public int Attempts { get; private set; }

    public string? LastError { get; private set; }

    public void MarkProcessed(DateTimeOffset processedAt)
    {
        ProcessedAt = processedAt;
        LastError = null;
    }

    public void MarkFailed(string error)
    {
        Attempts++;
        LastError = error.Length <= 2_000 ? error : error[..2_000];
    }
}
