using System.Security.Claims;
using System.Text.Encodings.Web;
using FlowPro.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace FlowPro.Api.Authentication;

internal sealed class DevelopmentAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "DevelopmentHeaders";

    /// <summary>
    /// Simulates a signed-in account that does not belong to any
    /// workspace yet, so the self-serve signup path can be exercised locally and in e2e.
    /// </summary>
    private const string UnclaimedSubjectHeader = "X-FlowPro-Subject";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        string? unclaimedSubject = ReadHeader(UnclaimedSubjectHeader);

        if (string.IsNullOrWhiteSpace(unclaimedSubject) && HasUnusableIdentityHeader())
        {
            // Omitting the identity headers entirely is the convenient local default and falls
            // back to the seeded developer. Sending one that is blank or malformed is a caller
            // stating it has no identity, so it must not be answered with the seeded superadmin.
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        ClaimsIdentity identity = string.IsNullOrWhiteSpace(unclaimedSubject)
            ? CreateTenantMemberIdentity()
            : CreateUnclaimedIdentity(unclaimedSubject);

        return Task.FromResult(
            AuthenticateResult.Success(
                new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName)));
    }

    private bool HasUnusableIdentityHeader() =>
        IsPresentButNotAGuid("X-FlowPro-Tenant-Id")
        || IsPresentButNotAGuid("X-FlowPro-User-Id");

    private bool IsPresentButNotAGuid(string name) =>
        Request.Headers.ContainsKey(name)
        && !Guid.TryParse(Request.Headers[name].ToString(), out _);

    private ClaimsIdentity CreateTenantMemberIdentity()
    {
        Guid tenantId = ReadGuidHeader("X-FlowPro-Tenant-Id") ?? DevelopmentSeedIds.TenantId;
        Guid userId = ReadGuidHeader("X-FlowPro-User-Id") ?? DevelopmentSeedIds.UserId;
        string email = ReadHeader("X-FlowPro-Email") ?? "developer@flowpro.test";
        string name = ReadHeader("X-FlowPro-Name") ?? "FlowPro Developer";

        return new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Name, name),
                new Claim("name", name),
                new Claim("email", email),
                new Claim(FlowProClaimTypes.TenantId, tenantId.ToString()),
                new Claim(FlowProClaimTypes.UserId, userId.ToString()),
            ],
            SchemeName);
    }

    private ClaimsIdentity CreateUnclaimedIdentity(string subject)
    {
        string email = ReadHeader("X-FlowPro-Email") ?? $"{subject}@flowpro.test";
        string name = ReadHeader("X-FlowPro-Name") ?? "New FlowPro User";

        return new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, subject),
                new Claim("sub", subject),
                new Claim(ClaimTypes.Name, name),
                new Claim("name", name),
                new Claim("email", email),
            ],
            SchemeName);
    }

    private string? ReadHeader(string name)
    {
        string value = Request.Headers[name].ToString();
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    private Guid? ReadGuidHeader(string name)
    {
        string value = Request.Headers[name].ToString();
        return Guid.TryParse(value, out Guid parsed) ? parsed : null;
    }
}
