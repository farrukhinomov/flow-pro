using System.Security.Claims;
using System.Text.Encodings.Web;
using FlowPro.Application.Accounts;
using FlowPro.Application.Common;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace FlowPro.Api.Authentication;

/// <summary>
/// Authenticates a request from its session cookie.
/// </summary>
/// <remarks>
/// The cookie holds an opaque token; the session itself lives in PostgreSQL, so signing out or
/// revoking a session takes effect on the next request. The resulting principal carries the
/// account identifier as its subject. Which tenant the caller acts in is resolved afterwards by
/// <see cref="FlowProClaimsTransformation" />, the same way for every authentication scheme.
/// </remarks>
internal sealed class SessionAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    SessionCookie cookie,
    IQueryHandler<ResolveSessionQuery, ResolvedSession?> sessions)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "Session";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        string? token = cookie.Read(Request);

        if (string.IsNullOrEmpty(token))
        {
            return AuthenticateResult.NoResult();
        }

        ResolvedSession? session = await sessions.HandleAsync(
            new ResolveSessionQuery(token),
            Context.RequestAborted);

        if (session is null)
        {
            // Expired, revoked or forged. Remove it so the browser stops sending it.
            cookie.Clear(Response);
            return AuthenticateResult.NoResult();
        }

        List<Claim> claims =
        [
            new("sub", session.AccountId.ToString()),
            new("email", session.Email),
            new("name", session.DisplayName),
            new(FlowProClaimTypes.SessionId, session.SessionId.ToString()),
        ];

        if (session.ActiveTenantId is not null)
        {
            claims.Add(new Claim(FlowProClaimTypes.TenantId, session.ActiveTenantId.Value.ToString()));
        }

        ClaimsIdentity identity = new(claims, SchemeName, "name", "role");
        return AuthenticateResult.Success(
            new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName));
    }
}
