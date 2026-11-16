using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Operations;

namespace FlowPro.Api.Operations;

public static class OperationsHealthEndpoints
{
    public static IEndpointRouteBuilder MapOperationsHealthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder group = endpoints.MapGroup("/api/v1/operations").WithTags("Operations");

        group.MapGet(
                "/health",
                async (
                    IQueryHandler<GetOperationsHealthQuery, OperationsHealthDto> handler,
                    CancellationToken cancellationToken) =>
                {
                    OperationsHealthDto health = await handler.HandleAsync(
                        new GetOperationsHealthQuery(),
                        cancellationToken);

                    return Results.Ok(health);
                })
            .RequireAuthorization(PermissionKeys.AuditViewFull);

        return endpoints;
    }
}
