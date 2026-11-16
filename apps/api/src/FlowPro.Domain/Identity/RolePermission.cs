namespace FlowPro.Domain.Identity;

public sealed class RolePermission
{
    private RolePermission()
    {
    }

    public RolePermission(Guid tenantId, Guid roleId, Guid permissionId)
    {
        TenantId = tenantId;
        RoleId = roleId;
        PermissionId = permissionId;
    }

    public Guid TenantId { get; private set; }

    public Guid RoleId { get; private set; }

    public Guid PermissionId { get; private set; }
}
