using FlowPro.Domain.Common;

namespace FlowPro.Domain.Organization;

public sealed class Employee : ITrackedEntity
{
    private Employee()
    {
    }

    public Employee(
        Guid tenantId,
        Guid userId,
        string personnelNumber,
        string givenName,
        string familyName,
        Guid? id = null)
    {
        Id = id ?? Guid.CreateVersion7();
        TenantId = tenantId;
        UserId = userId;
        PersonnelNumber = Guard.Required(personnelNumber, nameof(personnelNumber), 50);
        GivenName = Guard.Required(givenName, nameof(givenName), 100);
        FamilyName = Guard.Required(familyName, nameof(familyName), 100);
        IsActive = true;
        Version = 1;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid UserId { get; private set; }

    public string PersonnelNumber { get; private set; } = string.Empty;

    public string GivenName { get; private set; } = string.Empty;

    public string FamilyName { get; private set; } = string.Empty;

    public Guid? TeamId { get; private set; }

    public Guid? DepartmentId { get; private set; }

    public Guid? PrimaryLocationId { get; private set; }

    public bool IsActive { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public long Version { get; private set; }

    public void UpdateProfile(
        string personnelNumber,
        string givenName,
        string familyName,
        Guid? teamId,
        Guid? departmentId,
        Guid? primaryLocationId,
        bool isActive)
    {
        PersonnelNumber = Guard.Required(personnelNumber, nameof(personnelNumber), 50);
        GivenName = Guard.Required(givenName, nameof(givenName), 100);
        FamilyName = Guard.Required(familyName, nameof(familyName), 100);
        TeamId = teamId;
        DepartmentId = departmentId;
        PrimaryLocationId = primaryLocationId;
        IsActive = isActive;
        Version++;
    }
}
