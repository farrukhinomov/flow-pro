using FlowPro.Application.Common;
using FlowPro.Application.Identity;

namespace FlowPro.Api.Authentication;

internal static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthenticationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet(
                "/api/v1/auth/session",
                async (
                    HttpContext httpContext,
                    IQueryHandler<GetCurrentSessionQuery, CurrentSession> handler,
                    CancellationToken cancellationToken) =>
                {
                    httpContext.Response.Headers.CacheControl = "no-store, no-cache, must-revalidate";
                    httpContext.Response.Headers.Pragma = "no-cache";
                    httpContext.Response.Headers.Expires = "0";

                    CurrentSession session = await handler.HandleAsync(
                        new GetCurrentSessionQuery(),
                        cancellationToken);

                    return Results.Ok(session);
                })
            .WithTags("Authentication")
            .RequireAuthorization();

        return endpoints;
    }
}
