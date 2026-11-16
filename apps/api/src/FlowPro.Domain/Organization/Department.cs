using FlowPro.Domain.Common;

namespace FlowPro.Domain.Organization;

public sealed class Department : ITrackedEntity
{
    private Department()
    {
    }

    public Department(Guid tenantId, string code, string name)
    {
        Id = Guid.CreateVersion7();
        TenantId = tenantId;
        Code = Guard.Required(code, nameof(code), 50).ToUpperInvariant();
        Name = Guard.Required(name, nameof(name), 150);
        Version = 1;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string Code { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public long Version { get; private set; }

    public void Update(string code, string name)
    {
        Code = Guard.Required(code, nameof(code), 50).ToUpperInvariant();
        Name = Guard.Required(name, nameof(name), 150);
    }
}
