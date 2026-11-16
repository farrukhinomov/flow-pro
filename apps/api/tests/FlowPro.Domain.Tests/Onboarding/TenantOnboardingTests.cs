using FlowPro.Domain.Common;
using FlowPro.Domain.Onboarding;

namespace FlowPro.Domain.Tests.Onboarding;

public sealed class TenantOnboardingTests
{
    private static readonly Guid TenantId = Guid.Parse("01975fa8-7590-7000-8000-000000000301");
    private static readonly Guid UserId = Guid.Parse("01975fa8-7590-7000-8000-000000000302");
    private static readonly DateTimeOffset Now = new(2026, 7, 30, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public void New_onboarding_starts_in_progress_on_the_company_step()
    {
        TenantOnboarding onboarding = new(TenantId, UserId);

        Assert.Equal(OnboardingStatus.InProgress, onboarding.Status);
        Assert.Equal(OnboardingStep.Company, onboarding.CurrentStep);
        Assert.Null(onboarding.CompletedAt);
        Assert.All(TenantOnboarding.AllSteps, step => Assert.False(onboarding.IsResolved(step)));
    }

    [Fact]
    public void Current_step_advances_as_steps_are_resolved()
    {
        TenantOnboarding onboarding = new(TenantId, UserId);

        onboarding.ResolveStep(OnboardingStep.Company, skipped: false, Now);
        Assert.Equal(OnboardingStep.Team, onboarding.CurrentStep);

        onboarding.ResolveStep(OnboardingStep.Team, skipped: true, Now);
        Assert.Equal(OnboardingStep.Absences, onboarding.CurrentStep);

        onboarding.ResolveStep(OnboardingStep.Absences, skipped: false, Now);
        Assert.Equal(OnboardingStep.FirstClockIn, onboarding.CurrentStep);

        onboarding.ResolveStep(OnboardingStep.FirstClockIn, skipped: false, Now);
        Assert.Null(onboarding.CurrentStep);
    }

    [Fact]
    public void Steps_may_be_resolved_out_of_order()
    {
        TenantOnboarding onboarding = new(TenantId, UserId);

        onboarding.ResolveStep(OnboardingStep.Absences, skipped: false, Now);

        Assert.True(onboarding.IsResolved(OnboardingStep.Absences));
        Assert.Equal(OnboardingStep.Company, onboarding.CurrentStep);
    }

    [Fact]
    public void Resolving_a_step_again_overwrites_the_previous_outcome()
    {
        TenantOnboarding onboarding = new(TenantId, UserId);

        onboarding.ResolveStep(OnboardingStep.Team, skipped: true, Now);
        Assert.True(onboarding.WasSkipped(OnboardingStep.Team));

        onboarding.ResolveStep(OnboardingStep.Team, skipped: false, Now.AddMinutes(5));

        Assert.False(onboarding.WasSkipped(OnboardingStep.Team));
        Assert.Equal(Now.AddMinutes(5), onboarding.ResolvedAt(OnboardingStep.Team));
    }

    [Fact]
    public void Completing_records_unreached_steps_as_skipped()
    {
        TenantOnboarding onboarding = new(TenantId, UserId);
        onboarding.ResolveStep(OnboardingStep.Company, skipped: false, Now);

        onboarding.Complete(Now.AddMinutes(10));

        Assert.Equal(OnboardingStatus.Completed, onboarding.Status);
        Assert.Equal(Now.AddMinutes(10), onboarding.CompletedAt);
        Assert.False(onboarding.WasSkipped(OnboardingStep.Company));
        Assert.True(onboarding.WasSkipped(OnboardingStep.Team));
        Assert.True(onboarding.WasSkipped(OnboardingStep.Absences));
        Assert.True(onboarding.WasSkipped(OnboardingStep.FirstClockIn));
        Assert.Null(onboarding.CurrentStep);
    }

    [Fact]
    public void Completing_twice_is_rejected()
    {
        TenantOnboarding onboarding = new(TenantId, UserId);
        onboarding.Complete(Now);

        DomainRuleException exception = Assert.Throws<DomainRuleException>(
            () => onboarding.Complete(Now.AddMinutes(1)));

        Assert.Equal("onboarding.already_completed", exception.Code);
    }

    [Fact]
    public void Resolving_a_step_after_completion_is_rejected()
    {
        TenantOnboarding onboarding = new(TenantId, UserId);
        onboarding.Complete(Now);

        DomainRuleException exception = Assert.Throws<DomainRuleException>(
            () => onboarding.ResolveStep(OnboardingStep.Company, skipped: false, Now.AddMinutes(1)));

        Assert.Equal("onboarding.already_completed", exception.Code);
    }

    [Fact]
    public void Tenant_and_starting_user_are_required()
    {
        Assert.Throws<ArgumentException>(() => new TenantOnboarding(Guid.Empty, UserId));
        Assert.Throws<ArgumentException>(() => new TenantOnboarding(TenantId, Guid.Empty));
    }
}
