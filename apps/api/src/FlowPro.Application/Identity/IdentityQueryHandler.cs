using FlowPro.Application.Common;

namespace FlowPro.Application.Identity;

public sealed class IdentityQueryHandler(
    ICurrentRequestContext requestContext,
    IIdentitySessionRepository sessions)
    : IQueryHandler<GetCurrentSessionQuery, CurrentSession>
{
    public async Task<CurrentSession> HandleAsync(
        GetCurrentSessionQuery query,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        CurrentSession? session = await sessions.GetCurrentSessionAsync(
            identity.TenantId,
            identity.UserId,
            cancellationToken);

        return session ?? throw new FlowProUnauthorizedException();
    }
}
