using FlowPro.Domain.Common;

namespace FlowPro.Domain.Organization;

public sealed class WorkPattern : ITrackedEntity
{
    private WorkPattern()
    {
    }

    public WorkPattern(
        Guid tenantId,
        string externalId,
        string label,
        int weeklyMinutes,
        string? description,
        bool isActive,
        Guid? id = null)
    {
        if (weeklyMinutes is < 0 or > 10_080)
        {
            throw new ArgumentOutOfRangeException(nameof(weeklyMinutes));
        }

        Id = id ?? Guid.CreateVersion7();
        TenantId = tenantId;
        ExternalId = Guard.Required(externalId, nameof(externalId), 120);
        Label = Guard.Required(label, nameof(label), 150);
        WeeklyMinutes = weeklyMinutes;
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        IsActive = isActive;
        Version = 1;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string ExternalId { get; private set; } = string.Empty;

    public string Label { get; private set; } = string.Empty;

    public int WeeklyMinutes { get; private set; }

    public string? Description { get; private set; }

    public bool IsActive { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public long Version { get; private set; }

    public void Update(string label, int weeklyMinutes, string? description, bool isActive)
    {
        if (weeklyMinutes is < 0 or > 10_080)
        {
            throw new ArgumentOutOfRangeException(nameof(weeklyMinutes));
        }

        Label = Guard.Required(label, nameof(label), 150);
        WeeklyMinutes = weeklyMinutes;
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        IsActive = isActive;
        Version++;
    }
}
