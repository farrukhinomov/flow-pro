using FlowPro.Application.Demo;

namespace FlowPro.Api.Authentication;

internal static class DemoEndpoints
{
    /// <summary>
    /// What the sign-in page needs to offer the shared demo logins. Answers 404 when the demo is
    /// off, so an ordinary instance reveals nothing.
    /// </summary>
    public static IEndpointRouteBuilder MapDemoEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet(
                "/api/v1/demo",
                (DemoOptions options) => options.Enabled
                    ? Results.Ok(new DemoInfoResponse(
                        options.Password!,
                        options.ResetAtUtc.ToString("HH:mm", System.Globalization.CultureInfo.InvariantCulture),
                        [
                            .. DemoWorkspace.Logins.Select(login => new DemoLoginResponse(
                                login.RoleKey,
                                login.Email,
                                login.DisplayName)),
                        ]))
                    : Results.NotFound())
            .WithTags("Demo")
            .AllowAnonymous();

        return endpoints;
    }
}

/// <param name="Password">Public by design: every visitor shares these logins.</param>
/// <param name="ResetAtUtc">When the demo is wiped every day, as <c>HH:mm</c> in UTC.</param>
internal sealed record DemoInfoResponse(string Password, string ResetAtUtc, IReadOnlyList<DemoLoginResponse> Logins);

internal sealed record DemoLoginResponse(string RoleKey, string Email, string DisplayName);
