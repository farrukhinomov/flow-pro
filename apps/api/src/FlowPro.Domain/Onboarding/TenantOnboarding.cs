using FlowPro.Domain.Common;

namespace FlowPro.Domain.Onboarding;

/// <summary>
/// Tracks first-run setup progress for a tenant.
/// </summary>
/// <remarks>
/// The aggregate owns progress only. Configuration written by a step (tenant profile,
/// default location, default work pattern, invited users, attendance policy) is owned by the
/// module that already owns that data. Steps may be resolved in any order so the wizard can
/// support back navigation and skipping.
/// </remarks>
public sealed class TenantOnboarding : ITrackedEntity
{
    public static readonly IReadOnlyList<OnboardingStep> AllSteps =
    [
        OnboardingStep.Company,
        OnboardingStep.Team,
        OnboardingStep.Absences,
        OnboardingStep.FirstClockIn,
    ];

    private TenantOnboarding()
    {
    }

    public TenantOnboarding(Guid tenantId, Guid startedByUserId, Guid? id = null)
    {
        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("A tenant is required.", nameof(tenantId));
        }

        if (startedByUserId == Guid.Empty)
        {
            throw new ArgumentException("A starting user is required.", nameof(startedByUserId));
        }

        Id = id ?? Guid.CreateVersion7();
        TenantId = tenantId;
        StartedByUserId = startedByUserId;
        Status = OnboardingStatus.InProgress;
        Version = 1;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid StartedByUserId { get; private set; }

    public OnboardingStatus Status { get; private set; }

    public DateTimeOffset? CompanyResolvedAt { get; private set; }

    public bool CompanySkipped { get; private set; }

    public DateTimeOffset? TeamResolvedAt { get; private set; }

    public bool TeamSkipped { get; private set; }

    public DateTimeOffset? AbsencesResolvedAt { get; private set; }

    public bool AbsencesSkipped { get; private set; }

    public DateTimeOffset? FirstClockInResolvedAt { get; private set; }

    public bool FirstClockInSkipped { get; private set; }

    public DateTimeOffset? CompletedAt { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public long Version { get; private set; }

    /// <summary>
    /// Gets the first unresolved step, or <see langword="null" /> when every step is resolved.
    /// </summary>
    public OnboardingStep? CurrentStep =>
        AllSteps.Cast<OnboardingStep?>().FirstOrDefault(step => !IsResolved(step!.Value));

    public bool IsResolved(OnboardingStep step) => ResolvedAt(step) is not null;

    public DateTimeOffset? ResolvedAt(OnboardingStep step) => step switch
    {
        OnboardingStep.Company => CompanyResolvedAt,
        OnboardingStep.Team => TeamResolvedAt,
        OnboardingStep.Absences => AbsencesResolvedAt,
        OnboardingStep.FirstClockIn => FirstClockInResolvedAt,
        _ => throw new ArgumentOutOfRangeException(nameof(step)),
    };

    public bool WasSkipped(OnboardingStep step) => step switch
    {
        OnboardingStep.Company => CompanySkipped,
        OnboardingStep.Team => TeamSkipped,
        OnboardingStep.Absences => AbsencesSkipped,
        OnboardingStep.FirstClockIn => FirstClockInSkipped,
        _ => throw new ArgumentOutOfRangeException(nameof(step)),
    };

    /// <summary>
    /// Records a step as done or skipped. Re-resolving a step overwrites the previous outcome so
    /// a user can revisit a step in the wizard.
    /// </summary>
    public void ResolveStep(OnboardingStep step, bool skipped, DateTimeOffset now)
    {
        if (Status == OnboardingStatus.Completed)
        {
            throw new DomainRuleException(
                "onboarding.already_completed",
                "Onboarding has already been completed for this workspace.");
        }

        switch (step)
        {
            case OnboardingStep.Company:
                CompanyResolvedAt = now;
                CompanySkipped = skipped;
                break;
            case OnboardingStep.Team:
                TeamResolvedAt = now;
                TeamSkipped = skipped;
                break;
            case OnboardingStep.Absences:
                AbsencesResolvedAt = now;
                AbsencesSkipped = skipped;
                break;
            case OnboardingStep.FirstClockIn:
                FirstClockInResolvedAt = now;
                FirstClockInSkipped = skipped;
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(step));
        }

        Version++;
    }

    /// <summary>
    /// Finishes onboarding. Any step the user never reached is recorded as skipped so the
    /// resulting record always explains how the workspace was set up.
    /// </summary>
    public void Complete(DateTimeOffset now)
    {
        if (Status == OnboardingStatus.Completed)
        {
            throw new DomainRuleException(
                "onboarding.already_completed",
                "Onboarding has already been completed for this workspace.");
        }

        foreach (OnboardingStep step in AllSteps.Where(step => !IsResolved(step)))
        {
            ResolveStep(step, skipped: true, now);
        }

        Status = OnboardingStatus.Completed;
        CompletedAt = now;
        Version++;
    }
}
