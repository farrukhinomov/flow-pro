using FlowPro.Domain.Common;

namespace FlowPro.Domain.Organization;

public sealed class Team : ITrackedEntity
{
    private Team()
    {
    }

    public Team(
        Guid tenantId,
        Guid? departmentId,
        string code,
        string name,
        Guid? id = null,
        string? externalId = null,
        Guid? managerUserId = null)
    {
        Id = id ?? Guid.CreateVersion7();
        TenantId = tenantId;
        DepartmentId = departmentId;
        ExternalId = string.IsNullOrWhiteSpace(externalId)
            ? CodeFromName(name)
            : Guard.Required(externalId, nameof(externalId), 120);
        Code = Guard.Required(code, nameof(code), 50).ToUpperInvariant();
        Name = Guard.Required(name, nameof(name), 150);
        ManagerUserId = managerUserId;
        Version = 1;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid? DepartmentId { get; private set; }

    public string ExternalId { get; private set; } = string.Empty;

    public string Code { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public Guid? ManagerUserId { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public long Version { get; private set; }

    public void Update(Guid? departmentId, string code, string name, string externalId, Guid? managerUserId)
    {
        DepartmentId = departmentId;
        ExternalId = Guard.Required(externalId, nameof(externalId), 120);
        Code = Guard.Required(code, nameof(code), 50).ToUpperInvariant();
        Name = Guard.Required(name, nameof(name), 150);
        ManagerUserId = managerUserId;
        Version++;
    }

    private static string CodeFromName(string name)
    {
        string code = new(
            Guard.Required(name, nameof(name), 150)
                .Select(character => char.IsLetterOrDigit(character) ? char.ToUpperInvariant(character) : '-')
                .ToArray());

        string normalized = string.Join('-', code.Split('-', StringSplitOptions.RemoveEmptyEntries));
        return normalized.Length > 50 ? normalized[..50] : normalized;
    }
}
