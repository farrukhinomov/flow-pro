namespace FlowPro.Domain.Identity;

public sealed class UserRole
{
    private UserRole()
    {
    }

    public UserRole(Guid tenantId, Guid userId, Guid roleId)
    {
        TenantId = tenantId;
        UserId = userId;
        RoleId = roleId;
    }

    public Guid TenantId { get; private set; }

    public Guid UserId { get; private set; }

    public Guid RoleId { get; private set; }
}
