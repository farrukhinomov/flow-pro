using FlowPro.Domain.Common;

namespace FlowPro.Domain.Notifications;

public sealed class NotificationRecord : ITrackedEntity
{
    private NotificationRecord()
    {
    }

    public NotificationRecord(
        Guid tenantId,
        string externalId,
        Guid recipientUserId,
        string type,
        string title,
        string? sourceId,
        DateTimeOffset createdAt)
    {
        Id = Guid.CreateVersion7();
        TenantId = tenantId;
        ExternalId = Guard.Required(externalId, nameof(externalId), 150);
        RecipientUserId = recipientUserId;
        Type = Guard.Required(type, nameof(type), 120);
        Title = Guard.Required(title, nameof(title), 300);
        SourceId = string.IsNullOrWhiteSpace(sourceId) ? null : Guard.Required(sourceId, nameof(sourceId), 150);
        CreatedAtUtc = createdAt;
        Version = 1;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string ExternalId { get; private set; } = string.Empty;

    public Guid RecipientUserId { get; private set; }

    public string Type { get; private set; } = string.Empty;

    public string Title { get; private set; } = string.Empty;

    public string? SourceId { get; private set; }

    public DateTimeOffset? ReadAt { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public long Version { get; private set; }

    public void MarkRead(DateTimeOffset readAt)
    {
        if (ReadAt is not null)
        {
            return;
        }

        ReadAt = readAt;
        Version++;
    }
}
