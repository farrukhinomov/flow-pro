using System.Security.Claims;
using FlowPro.Application.Common;

namespace FlowPro.Api.Authentication;

internal sealed class HttpCurrentRequestContext(IHttpContextAccessor httpContextAccessor)
    : ICurrentRequestContext
{
    public RequestIdentity GetRequiredIdentity()
    {
        return TryGetIdentity() ?? throw new FlowProUnauthorizedException();
    }

    public RequestIdentity? TryGetIdentity()
    {
        ClaimsPrincipal? principal = httpContextAccessor.HttpContext?.User;

        if (principal?.Identity?.IsAuthenticated != true)
        {
            return null;
        }

        string? tenantClaim = principal.FindFirstValue(FlowProClaimTypes.TenantId);
        string? userClaim = principal.FindFirstValue(FlowProClaimTypes.UserId);

        if (!Guid.TryParse(tenantClaim, out Guid tenantId)
            || !Guid.TryParse(userClaim, out Guid userId))
        {
            return null;
        }

        return new RequestIdentity(tenantId, userId);
    }
}
