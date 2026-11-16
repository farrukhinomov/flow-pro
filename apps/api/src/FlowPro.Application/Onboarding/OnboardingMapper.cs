using FlowPro.Domain.Onboarding;

namespace FlowPro.Application.Onboarding;

internal static class OnboardingMapper
{
    public static OnboardingStateDto Map(TenantOnboarding onboarding) =>
        new(
            onboarding.Status == OnboardingStatus.Completed ? "completed" : "in-progress",
            onboarding.CurrentStep is { } currentStep
                ? OnboardingDefaults.ToWireFormat(currentStep)
                : null,
            TenantOnboarding.AllSteps
                .Select(step => new OnboardingStepDto(
                    OnboardingDefaults.ToWireFormat(step),
                    onboarding.IsResolved(step),
                    onboarding.WasSkipped(step),
                    onboarding.ResolvedAt(step)))
                .ToArray(),
            onboarding.CompletedAt);
}
