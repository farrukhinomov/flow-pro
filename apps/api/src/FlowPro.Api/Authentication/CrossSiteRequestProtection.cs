namespace FlowPro.Api.Authentication;

/// <summary>
/// Rejects state-changing requests that another website caused the browser to send.
/// </summary>
/// <remarks>
/// With cookie authentication the browser attaches the session to requests on its own, so a
/// malicious page could try to act as the signed-in person (cross-site request forgery). Two
/// browser-supplied signals identify where a request came from, and scripts cannot forge either:
///
/// - <c>Sec-Fetch-Site</c> says whether the request is same-origin, same-site or cross-site.
/// - <c>Origin</c> names the page's origin on state-changing requests.
///
/// A state-changing request passes when it is same-origin, when it comes from an origin on the
/// CORS allow-list, or when it carries neither header, which means it did not come from a browser
/// page at all (a script or command-line client holds no ambient cookie to abuse).
/// </remarks>
internal sealed class CrossSiteRequestProtection(RequestDelegate next, IConfiguration configuration)
{
    private readonly HashSet<string> allowedOrigins = new(
        configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [],
        StringComparer.OrdinalIgnoreCase);

    public async Task InvokeAsync(HttpContext context)
    {
        if (IsSafeMethod(context.Request.Method) || IsTrustedSource(context.Request))
        {
            await next(context);
            return;
        }

        await Results.Problem(
                statusCode: StatusCodes.Status403Forbidden,
                title: "Cross-site request blocked",
                detail: "This request came from another site and was not accepted.",
                extensions: new Dictionary<string, object?> { ["code"] = "request.cross_site_blocked" })
            .ExecuteAsync(context);
    }

    private static bool IsSafeMethod(string method) =>
        HttpMethods.IsGet(method)
        || HttpMethods.IsHead(method)
        || HttpMethods.IsOptions(method)
        || HttpMethods.IsTrace(method);

    private bool IsTrustedSource(HttpRequest request)
    {
        string? origin = request.Headers.Origin.FirstOrDefault();
        string? fetchSite = request.Headers["Sec-Fetch-Site"].FirstOrDefault();

        if (origin is null && fetchSite is null)
        {
            return true;
        }

        if (origin is not null)
        {
            return allowedOrigins.Contains(origin) || IsSameOrigin(request, origin);
        }

        return fetchSite is "same-origin" or "none";
    }

    private static bool IsSameOrigin(HttpRequest request, string origin) =>
        Uri.TryCreate(origin, UriKind.Absolute, out Uri? originUri)
        && string.Equals(originUri.Scheme, request.Scheme, StringComparison.OrdinalIgnoreCase)
        && string.Equals(
            originUri.Authority,
            request.Host.Value,
            StringComparison.OrdinalIgnoreCase);
}
