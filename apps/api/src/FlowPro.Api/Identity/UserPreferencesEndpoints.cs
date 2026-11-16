using FlowPro.Application.Common;
using FlowPro.Application.Identity;

namespace FlowPro.Api.Identity;

internal static class UserPreferencesEndpoints
{
    public static IEndpointRouteBuilder MapUserPreferencesEndpoints(this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder group = endpoints
            .MapGroup("/api/v1/me/preferences")
            .WithTags("User preferences");

        // Any authenticated user may read and write their own preferences, and
        // the handler resolves the owner from the token rather than the
        // request, so no narrower permission applies.
        group.MapGet(
                "/",
                (
                    IQueryHandler<GetUserPreferencesQuery, UserPreferencesDto> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(new GetUserPreferencesQuery(), cancellationToken))
            .RequireAuthorization();

        group.MapPut(
                "/",
                (
                    SaveUserPreferencesCommand request,
                    ICommandHandler<SaveUserPreferencesCommand, UserPreferencesDto> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(request, cancellationToken))
            .RequireAuthorization();

        return endpoints;
    }
}
