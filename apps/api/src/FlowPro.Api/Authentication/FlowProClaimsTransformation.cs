using System.Security.Claims;
using FlowPro.Domain.Identity;
using FlowPro.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Api.Authentication;

internal readonly record struct UserTenantMatch(Guid UserId, Guid TenantId);

/// <summary>
/// Resolves which tenant membership an authenticated caller acts as, and adds it to the principal.
/// </summary>
/// <remarks>
/// Runs before the caller has a workspace, which is what it finds out, so its lookups look across
/// workspaces. Each one is narrowed to the caller's own account or subject.
/// </remarks>
internal sealed class FlowProClaimsTransformation(FlowProDbContext dbContext)
    : IClaimsTransformation
{
    public async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        if (principal.Identity?.IsAuthenticated != true
            || HasFlowProIdentity(principal))
        {
            return principal;
        }

        return await dbContext.AcrossTenantsAsync(
            () => ResolveAsync(principal),
            CancellationToken.None);
    }

    private async Task<ClaimsPrincipal> ResolveAsync(ClaimsPrincipal principal)
    {
        if (principal.HasClaim(claim => claim.Type == FlowProClaimTypes.SessionId))
        {
            await ResolveAccountMembershipAsync(principal);
            return principal;
        }

        // Development headers: either a membership given directly, or a bare subject.
        Guid? tenantId = FindGuidClaim(principal, FlowProClaimTypes.TenantId);
        Guid? userId = FindGuidClaim(principal, FlowProClaimTypes.UserId);

        if (tenantId is not null && userId is not null)
        {
            bool userIsActive = await UserIsActiveAsync(
                tenantId.Value,
                userId.Value,
                CancellationToken.None);

            if (userIsActive)
            {
                AddFlowProIdentity(principal, tenantId.Value, userId.Value);
            }

            return principal;
        }

        string? externalSubject = FindClaimValue(principal, "sub", ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(externalSubject))
        {
            return principal;
        }

        // A subject without a tenant is resolved across all tenants; the ambiguity rule below keeps
        // that safe when the subject belongs to several.
        // The tenant filter sits before the projection, where EF Core can translate it.
        IQueryable<UserTenantMatch> matches =
            from user in dbContext.Users.AsNoTracking()
            join tenant in dbContext.Tenants.AsNoTracking() on user.TenantId equals tenant.Id
            where user.ExternalSubject == externalSubject
                && user.Status == UserStatus.Active
                && tenant.IsActive
                && (tenantId == null || user.TenantId == tenantId)
            select new UserTenantMatch(user.Id, user.TenantId);

        // Two rows are enough to detect the ambiguous case. The same subject may legitimately
        // belong to several workspaces, and picking one would silently grant the wrong tenant, so
        // an ambiguous subject stays unresolved and the caller is told to authenticate.
        List<UserTenantMatch> resolved = await matches
            .Take(2)
            .ToListAsync(CancellationToken.None);

        if (resolved.Count == 1 && resolved[0].UserId != Guid.Empty)
        {
            AddFlowProIdentity(principal, resolved[0].TenantId, resolved[0].UserId);
        }

        return principal;
    }

    /// <summary>
    /// A session principal's subject is its account. The membership is found by that account,
    /// narrowed to the session's active tenant when one is set.
    /// </summary>
    private async Task ResolveAccountMembershipAsync(ClaimsPrincipal principal)
    {
        if (!Guid.TryParse(principal.FindFirstValue("sub"), out Guid accountId))
        {
            return;
        }

        Guid? activeTenantId = FindGuidClaim(principal, FlowProClaimTypes.TenantId);

        // The session's chosen workspace wins while the account still belongs to it. When it no
        // longer does (deactivated, or the workspace closed), the caller falls back to the rule
        // below rather than being locked out of every workspace.
        if (activeTenantId is not null)
        {
            List<UserTenantMatch> chosen = await AccountMemberships(accountId, activeTenantId)
                .Take(1)
                .ToListAsync(CancellationToken.None);

            if (chosen.Count == 1)
            {
                AddFlowProIdentity(principal, chosen[0].TenantId, chosen[0].UserId);
                return;
            }
        }

        IQueryable<UserTenantMatch> matches = AccountMemberships(accountId, tenantId: null);

        // Same rule as for external subjects: with several workspaces and none chosen, picking one
        // would grant the wrong tenant, so the caller stays unresolved until they choose.
        List<UserTenantMatch> resolved = await matches.Take(2).ToListAsync(CancellationToken.None);

        if (resolved.Count == 1)
        {
            AddFlowProIdentity(principal, resolved[0].TenantId, resolved[0].UserId);
        }
    }

    /// <summary>
    /// Active memberships of the account in active workspaces. The tenant filter is applied before
    /// the projection, where EF Core can translate it.
    /// </summary>
    private IQueryable<UserTenantMatch> AccountMemberships(Guid accountId, Guid? tenantId) =>
        from user in dbContext.Users.AsNoTracking()
        join tenant in dbContext.Tenants.AsNoTracking() on user.TenantId equals tenant.Id
        where user.AccountId == accountId
            && user.Status == UserStatus.Active
            && tenant.IsActive
            && (tenantId == null || user.TenantId == tenantId)
        select new UserTenantMatch(user.Id, user.TenantId);

    private Task<bool> UserIsActiveAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken) =>
        (
            from user in dbContext.Users.AsNoTracking()
            join tenant in dbContext.Tenants.AsNoTracking() on user.TenantId equals tenant.Id
            where user.TenantId == tenantId
                && user.Id == userId
                && user.Status == UserStatus.Active
                && tenant.IsActive
            select user.Id
        ).AnyAsync(cancellationToken);

    private static bool HasFlowProIdentity(ClaimsPrincipal principal) =>
        Guid.TryParse(principal.FindFirstValue(FlowProClaimTypes.TenantId), out _)
        && Guid.TryParse(principal.FindFirstValue(FlowProClaimTypes.UserId), out _);

    private static void AddFlowProIdentity(
        ClaimsPrincipal principal,
        Guid tenantId,
        Guid userId)
    {
        ClaimsIdentity identity = new("FlowProIdentity");
        identity.AddClaim(new Claim(FlowProClaimTypes.TenantId, tenantId.ToString()));
        identity.AddClaim(new Claim(FlowProClaimTypes.UserId, userId.ToString()));
        principal.AddIdentity(identity);
    }

    private static Guid? FindGuidClaim(ClaimsPrincipal principal, params string[] claimTypes)
    {
        string? value = FindClaimValue(principal, claimTypes);
        return Guid.TryParse(value, out Guid parsed) ? parsed : null;
    }

    private static string? FindClaimValue(ClaimsPrincipal principal, params string[] claimTypes)
    {
        foreach (string claimType in claimTypes.Where(type => !string.IsNullOrWhiteSpace(type)))
        {
            string? value = principal.FindFirstValue(claimType);
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }
        }

        return null;
    }
}
