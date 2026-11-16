using FlowPro.Domain.Common;

namespace FlowPro.Domain.Organization;

public sealed class ManagerDelegation : ITrackedEntity
{
    private ManagerDelegation()
    {
    }

    public ManagerDelegation(Guid tenantId, Guid managerUserId, Guid teamId, Guid? id = null)
    {
        Id = id ?? Guid.CreateVersion7();
        TenantId = tenantId;
        ManagerUserId = managerUserId;
        TeamId = teamId;
        IsActive = true;
        Version = 1;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid ManagerUserId { get; private set; }

    public Guid TeamId { get; private set; }

    public bool IsActive { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public long Version { get; private set; }

    public void Activate()
    {
        IsActive = true;
        Version++;
    }

    public void Deactivate()
    {
        IsActive = false;
        Version++;
    }
}
