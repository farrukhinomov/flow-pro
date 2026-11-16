using FlowPro.Api.Authentication;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Onboarding;
using FlowPro.Domain.Onboarding;

namespace FlowPro.Api.Onboarding;

internal static class OnboardingEndpoints
{
    public static IEndpointRouteBuilder MapOnboardingEndpoints(this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder group = endpoints
            .MapGroup("/api/v1/onboarding")
            .WithTags("Onboarding");

        // Workspace claim runs before the caller belongs to a tenant, so it cannot require a
        // tenant-scoped permission. A signed-in account is the only gate, plus
        // a dedicated rate limit because this endpoint creates tenants.
        group.MapGet(
                "/workspace",
                (
                    IQueryHandler<GetWorkspaceClaimStateQuery, WorkspaceClaimState> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(new GetWorkspaceClaimStateQuery(), cancellationToken))
            .RequireAuthorization();

        group.MapPost(
                "/workspace",
                (
                    ClaimWorkspaceCommand request,
                    ICommandHandler<ClaimWorkspaceCommand, WorkspaceClaimResult> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(request, cancellationToken))
            .RequireAuthorization()
            .RequireRateLimiting(RateLimitPolicies.WorkspaceClaim);

        // Every member needs to read setup state so the client can route into or past the wizard.
        group.MapGet(
                "/state",
                (
                    IQueryHandler<GetOnboardingStateQuery, OnboardingStateDto> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(new GetOnboardingStateQuery(), cancellationToken))
            .RequireAuthorization();

        group.MapPut(
                "/steps/company",
                (
                    SaveCompanyProfileCommand request,
                    ICommandHandler<SaveCompanyProfileCommand, CompanyProfileDto> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(request, cancellationToken))
            .RequireAuthorization(PermissionKeys.OrganizationManage);

        group.MapPost(
                "/steps/{step}/resolve",
                (
                    string step,
                    ResolveStepRequest? request,
                    ICommandHandler<ResolveOnboardingStepCommand, OnboardingStateDto> handler,
                    CancellationToken cancellationToken) =>
                    OnboardingDefaults.TryParseStep(step, out OnboardingStep parsedStep)
                        ? handler.HandleAsync(
                            new ResolveOnboardingStepCommand(parsedStep, request?.Skipped ?? false),
                            cancellationToken)
                        : throw new FlowProValidationException(
                            "onboarding.step_unknown",
                            "Unknown onboarding step."))
            .RequireAuthorization(PermissionKeys.OrganizationManage);

        group.MapPost(
                "/complete",
                (
                    ICommandHandler<CompleteOnboardingCommand, OnboardingStateDto> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(new CompleteOnboardingCommand(), cancellationToken))
            .RequireAuthorization(PermissionKeys.OrganizationManage);

        return endpoints;
    }

    private sealed record ResolveStepRequest(bool Skipped = false);
}
