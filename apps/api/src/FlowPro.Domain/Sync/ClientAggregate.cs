using FlowPro.Domain.Common;

namespace FlowPro.Domain.Sync;

public sealed class ClientAggregate : ITrackedEntity
{
    private ClientAggregate()
    {
    }

    public ClientAggregate(
        Guid tenantId,
        string aggregateType,
        string aggregateId,
        string payloadJson,
        string clientOperationId,
        DateTimeOffset clientUpdatedAt,
        Guid? ownerUserId)
    {
        TenantId = tenantId;
        AggregateType = Guard.Required(aggregateType, nameof(aggregateType), 100);
        AggregateId = Guard.Required(aggregateId, nameof(aggregateId), 150);
        PayloadJson = Guard.Required(payloadJson, nameof(payloadJson), 256_000);
        LastClientOperationId = Guard.Required(clientOperationId, nameof(clientOperationId), 150);
        ClientUpdatedAt = clientUpdatedAt;
        OwnerUserId = ownerUserId;
        IsDeleted = false;
        Version = 1;
    }

    public Guid TenantId { get; private set; }

    public string AggregateType { get; private set; } = string.Empty;

    public string AggregateId { get; private set; } = string.Empty;

    public string PayloadJson { get; private set; } = string.Empty;

    public string LastClientOperationId { get; private set; } = string.Empty;

    public DateTimeOffset ClientUpdatedAt { get; private set; }

    public Guid? OwnerUserId { get; private set; }

    public bool IsDeleted { get; private set; }

    public DateTimeOffset? DeletedAt { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public long Version { get; private set; }

    public string ServerVersion => $"v{Version}";

    public void Upsert(
        string payloadJson,
        string clientOperationId,
        DateTimeOffset clientUpdatedAt)
    {
        PayloadJson = Guard.Required(payloadJson, nameof(payloadJson), 256_000);
        LastClientOperationId = Guard.Required(clientOperationId, nameof(clientOperationId), 150);
        ClientUpdatedAt = clientUpdatedAt;
        IsDeleted = false;
        DeletedAt = null;
        Version++;
    }

    public void Delete(string clientOperationId, DateTimeOffset clientUpdatedAt)
    {
        LastClientOperationId = Guard.Required(clientOperationId, nameof(clientOperationId), 150);
        ClientUpdatedAt = clientUpdatedAt;
        IsDeleted = true;
        DeletedAt = clientUpdatedAt;
        Version++;
    }
}
