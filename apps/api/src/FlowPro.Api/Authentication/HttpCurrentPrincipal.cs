using System.Security.Claims;
using FlowPro.Application.Common;

namespace FlowPro.Api.Authentication;

/// <summary>
/// Reads the signed-in caller without requiring that they already belong to a FlowPro tenant.
/// </summary>
/// <remarks>
/// Self-serve signup happens in the window between "has an account" and "member of a workspace".
/// <see cref="HttpCurrentRequestContext" /> returns nothing in that window by design, so
/// provisioning uses this instead.
/// </remarks>
internal sealed class HttpCurrentPrincipal(IHttpContextAccessor httpContextAccessor)
    : ICurrentPrincipal
{
    public PrincipalIdentity GetRequiredPrincipal() =>
        TryGetPrincipal() ?? throw new FlowProUnauthorizedException();

    public PrincipalIdentity? TryGetPrincipal()
    {
        ClaimsPrincipal? principal = httpContextAccessor.HttpContext?.User;

        if (principal?.Identity?.IsAuthenticated != true)
        {
            return null;
        }

        string? externalSubject = FindClaimValue(principal, "sub", ClaimTypes.NameIdentifier);
        string? email = FindClaimValue(principal, "email", ClaimTypes.Email, "preferred_username");

        if (string.IsNullOrWhiteSpace(externalSubject) || string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        string displayName = FindClaimValue(principal, "name", ClaimTypes.Name)
            ?? BuildDisplayName(principal)
            ?? email.Split('@')[0];

        // A session principal's subject is the FlowPro account identifier.
        Guid? accountId = principal.HasClaim(claim => claim.Type == FlowProClaimTypes.SessionId)
            && Guid.TryParse(externalSubject, out Guid parsedAccountId)
                ? parsedAccountId
                : null;

        return new PrincipalIdentity(
            externalSubject.Trim(),
            email.Trim().ToLowerInvariant(),
            displayName.Trim(),
            accountId);
    }

    private static string? BuildDisplayName(ClaimsPrincipal principal)
    {
        string? givenName = FindClaimValue(principal, "given_name", ClaimTypes.GivenName);
        string? familyName = FindClaimValue(principal, "family_name", ClaimTypes.Surname);
        string combined = string.Join(
            ' ',
            new[] { givenName, familyName }.Where(part => !string.IsNullOrWhiteSpace(part)));

        return combined.Length == 0 ? null : combined;
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
