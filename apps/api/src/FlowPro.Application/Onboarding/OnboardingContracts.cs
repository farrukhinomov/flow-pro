using FlowPro.Application.Common;
using FlowPro.Domain.Onboarding;

namespace FlowPro.Application.Onboarding;

/// <summary>
/// Reads whether the signed-in account already belongs to a workspace.
/// Runs before a tenant exists, so it reads the raw token principal rather than a request identity.
/// </summary>
public sealed record GetWorkspaceClaimStateQuery : IQuery<WorkspaceClaimState>;

public sealed record WorkspaceClaimState(
    bool HasWorkspace,
    string Email,
    string DisplayName,
    string SuggestedWorkspaceName,
    string SuggestedSlug);

/// <summary>
/// Provisions a tenant for the signed-in account and makes that account the
/// workspace owner.
/// </summary>
public sealed record ClaimWorkspaceCommand(
    string WorkspaceName,
    string? Slug = null) : ICommand<WorkspaceClaimResult>;

public sealed record WorkspaceClaimResult(
    Guid TenantId,
    string TenantSlug,
    string TenantName,
    Guid UserId,
    Guid EmployeeId,
    OnboardingStateDto Onboarding);

public sealed record GetOnboardingStateQuery : IQuery<OnboardingStateDto>;

public sealed record OnboardingStateDto(
    string Status,
    string? CurrentStep,
    IReadOnlyList<OnboardingStepDto> Steps,
    DateTimeOffset? CompletedAt);

public sealed record OnboardingStepDto(
    string Step,
    bool Resolved,
    bool Skipped,
    DateTimeOffset? ResolvedAt);

/// <summary>
/// Saves the company step: workspace profile, default location time zone, and the default weekly
/// working time the rest of the product measures against.
/// </summary>
public sealed record SaveCompanyProfileCommand(
    string CompanyName,
    string? CountryCode,
    string? RegionCode,
    string TimeZoneId,
    decimal WeeklyHours) : ICommand<CompanyProfileDto>;

public sealed record CompanyProfileDto(
    string CompanyName,
    string? CountryCode,
    string? RegionCode,
    string TimeZoneId,
    decimal WeeklyHours,
    OnboardingStateDto Onboarding);

/// <summary>
/// Records a step as done or skipped without owning the data that step configures.
/// </summary>
public sealed record ResolveOnboardingStepCommand(
    OnboardingStep Step,
    bool Skipped = false) : ICommand<OnboardingStateDto>;

public sealed record CompleteOnboardingCommand : ICommand<OnboardingStateDto>;
