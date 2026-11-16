using FlowPro.Domain.Common;

namespace FlowPro.Domain.Organization;

public sealed class EmploymentContract : ITrackedEntity
{
    private EmploymentContract()
    {
    }

    public EmploymentContract(
        Guid tenantId,
        Guid employeeId,
        DateOnly effectiveFrom,
        int weeklyMinutes,
        string timeZoneId)
    {
        if (weeklyMinutes is <= 0 or > 10_080)
        {
            throw new ArgumentOutOfRangeException(nameof(weeklyMinutes));
        }

        Id = Guid.CreateVersion7();
        TenantId = tenantId;
        EmployeeId = employeeId;
        EffectiveFrom = effectiveFrom;
        WeeklyMinutes = weeklyMinutes;
        TimeZoneId = Guard.Required(timeZoneId, nameof(timeZoneId), 100);
        Version = 1;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid EmployeeId { get; private set; }

    public DateOnly EffectiveFrom { get; private set; }

    public DateOnly? EffectiveTo { get; private set; }

    public int WeeklyMinutes { get; private set; }

    public string TimeZoneId { get; private set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public long Version { get; private set; }

    public void Update(DateOnly effectiveFrom, DateOnly? effectiveTo, int weeklyMinutes, string timeZoneId)
    {
        if (weeklyMinutes is <= 0 or > 10_080)
        {
            throw new ArgumentOutOfRangeException(nameof(weeklyMinutes));
        }

        if (effectiveTo is DateOnly end && end < effectiveFrom)
        {
            throw new ArgumentException("Effective end date must not be before start date.", nameof(effectiveTo));
        }

        EffectiveFrom = effectiveFrom;
        EffectiveTo = effectiveTo;
        WeeklyMinutes = weeklyMinutes;
        TimeZoneId = Guard.Required(timeZoneId, nameof(timeZoneId), 100);
        Version++;
    }
}
