using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using Microsoft.AspNetCore.Authorization;

namespace FlowPro.Api.Authentication;

internal sealed record PermissionRequirement(string Permission) : IAuthorizationRequirement;

internal sealed class PermissionAuthorizationHandler(
    ICurrentRequestContext requestContext,
    IPermissionChecker permissionChecker) : AuthorizationHandler<PermissionRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        if (context.User.Identity?.IsAuthenticated != true)
        {
            return;
        }

        RequestIdentity identity;

        try
        {
            identity = requestContext.GetRequiredIdentity();
        }
        catch (FlowProUnauthorizedException)
        {
            return;
        }

        if (await permissionChecker.HasPermissionAsync(
                identity.TenantId,
                identity.UserId,
                requirement.Permission,
                CancellationToken.None))
        {
            context.Succeed(requirement);
        }
    }
}
