using FlowPro.Domain.Common;

namespace FlowPro.Domain.Identity;

public sealed class Permission : ITrackedEntity
{
    private Permission()
    {
    }

    public Permission(string key, string description, Guid? id = null)
    {
        Id = id ?? Guid.CreateVersion7();
        Key = Guard.Required(key, nameof(key), 150).ToLowerInvariant();
        Description = Guard.Required(description, nameof(description), 300);
        Version = 1;
    }

    public Guid Id { get; private set; }

    public string Key { get; private set; } = string.Empty;

    public string Description { get; private set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public long Version { get; private set; }
}
