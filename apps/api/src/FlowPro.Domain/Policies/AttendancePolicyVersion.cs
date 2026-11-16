using FlowPro.Domain.Common;

namespace FlowPro.Domain.Policies;

/// <summary>
/// One published revision of an attendance policy.
/// </summary>
/// <remarks>
/// Carries two distinct timestamps, and the difference matters for compliance.
/// <see cref="PublishedAt"/> records when an administrator saved the revision;
/// <see cref="EffectiveFrom"/> records the date its rules start governing work.
/// They are usually different: a works council agrees new break rules in
/// December that apply from 1 January.
///
/// Without the second, "which policy governed this timesheet?" is unanswerable,
/// which is the question an audit of a historic period actually asks.
/// </remarks>
public sealed class AttendancePolicyVersion : ITrackedEntity
{
    private AttendancePolicyVersion()
    {
    }

    public AttendancePolicyVersion(
        Guid tenantId,
        string policyId,
        int versionNumber,
        string configJson,
        Guid publishedByUserId,
        DateTimeOffset publishedAt,
        DateTimeOffset effectiveFrom)
    {
        Id = Guid.CreateVersion7();
        TenantId = tenantId;
        PolicyId = Guard.Required(policyId, nameof(policyId), 80);
        VersionNumber = versionNumber;
        ConfigJson = Guard.Required(configJson, nameof(configJson), 256_000);
        PublishedByUserId = publishedByUserId;
        PublishedAt = publishedAt;
        EffectiveFrom = effectiveFrom;
        IsCurrent = true;
        Version = 1;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string PolicyId { get; private set; } = "default";

    public int VersionNumber { get; private set; }

    public string ConfigJson { get; private set; } = string.Empty;

    public Guid PublishedByUserId { get; private set; }

    public DateTimeOffset PublishedAt { get; private set; }

    /// <summary>When this revision's rules start governing work.</summary>
    public DateTimeOffset EffectiveFrom { get; private set; }

    /// <summary>
    /// Whether this is the most recently published revision.
    /// </summary>
    /// <remarks>
    /// Bookkeeping for the publish path, not the answer to "what applies now".
    /// A revision scheduled for next month is the latest published one while a
    /// different revision still governs today, so reads resolve by
    /// <see cref="EffectiveFrom"/> rather than by this flag.
    /// </remarks>
    public bool IsCurrent { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public long Version { get; private set; }

    public void Supersede() => IsCurrent = false;

    /// <summary>
    /// Whether this revision governs <paramref name="at"/>.
    /// </summary>
    /// <remarks>
    /// Inclusive of the effective instant: a policy effective from midnight on
    /// 1 January governs work booked at midnight on 1 January.
    /// </remarks>
    public bool GovernsAt(DateTimeOffset at) => EffectiveFrom <= at;
}
