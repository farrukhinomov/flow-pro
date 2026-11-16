using FlowPro.Domain.Common;

namespace FlowPro.Domain.Organization;

public sealed class RoleProfile : ITrackedEntity
{
    private RoleProfile()
    {
    }

    public RoleProfile(
        Guid tenantId,
        string externalId,
        string label,
        string baseRole,
        string? description,
        bool isActive,
        Guid? id = null)
    {
        Id = id ?? Guid.CreateVersion7();
        TenantId = tenantId;
        ExternalId = Guard.Required(externalId, nameof(externalId), 120);
        Label = Guard.Required(label, nameof(label), 150);
        BaseRole = Guard.Required(baseRole, nameof(baseRole), 50).ToLowerInvariant();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        IsActive = isActive;
        Version = 1;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string ExternalId { get; private set; } = string.Empty;

    public string Label { get; private set; } = string.Empty;

    public string BaseRole { get; private set; } = string.Empty;

    public string? Description { get; private set; }

    public bool IsActive { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public long Version { get; private set; }

    public void Update(string label, string baseRole, string? description, bool isActive)
    {
        Label = Guard.Required(label, nameof(label), 150);
        BaseRole = Guard.Required(baseRole, nameof(baseRole), 50).ToLowerInvariant();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        IsActive = isActive;
        Version++;
    }
}
