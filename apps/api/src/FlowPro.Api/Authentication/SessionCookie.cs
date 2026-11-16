namespace FlowPro.Api.Authentication;

/// <summary>
/// The browser cookie that carries the session token.
/// </summary>
/// <remarks>
/// - HttpOnly: page scripts cannot read it, so a script-injection bug cannot steal the session.
/// - SameSite=Lax: other sites cannot make the browser send it on background requests.
/// - Secure with the <c>__Host-</c> prefix outside Development: the browser only sends it over
///   HTTPS and refuses to let another host or path overwrite it.
/// </remarks>
internal sealed class SessionCookie(IHostEnvironment environment)
    : HostCookie(environment, "flowpro_session", SameSiteMode.Lax);

/// <summary>
/// Carries the sign-in challenge between the password and the code, for at most a few minutes.
/// </summary>
/// <remarks>
/// Kept out of page scripts like the session cookie. SameSite=Strict because it is only ever
/// needed by this site's own sign-in page.
/// </remarks>
internal sealed class TwoFactorChallengeCookie(IHostEnvironment environment)
    : HostCookie(environment, "flowpro_two_factor", SameSiteMode.Strict);

internal abstract class HostCookie(IHostEnvironment environment, string baseName, SameSiteMode sameSite)
{
    // Plain HTTP on localhost is normal in development, and the __Host- prefix requires HTTPS.
    private bool Secure => !environment.IsDevelopment();

    public string Name => Secure ? $"__Host-{baseName}" : baseName;

    public string? Read(HttpRequest request) =>
        request.Cookies.TryGetValue(Name, out string? value) ? value : null;

    public void Write(HttpResponse response, string token, DateTimeOffset expiresAt) =>
        response.Cookies.Append(Name, token, BuildOptions(expiresAt));

    public void Clear(HttpResponse response) =>
        response.Cookies.Delete(Name, BuildOptions(expiresAt: null));

    private CookieOptions BuildOptions(DateTimeOffset? expiresAt) => new()
    {
        HttpOnly = true,
        Secure = Secure,
        SameSite = sameSite,
        Path = "/",
        Expires = expiresAt,
        IsEssential = true,
    };
}
