using FlowPro.Domain.Common;

namespace FlowPro.Domain.Identity;

public sealed class Role : ITrackedEntity
{
    private Role()
    {
    }

    public Role(Guid tenantId, string key, string name, Guid? id = null)
    {
        Id = id ?? Guid.CreateVersion7();
        TenantId = tenantId;
        Key = Guard.Required(key, nameof(key), 100).ToLowerInvariant();
        Name = Guard.Required(name, nameof(name), 150);
        Version = 1;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string Key { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public long Version { get; private set; }
}
