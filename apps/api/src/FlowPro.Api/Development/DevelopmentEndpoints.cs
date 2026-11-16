using FlowPro.Infrastructure.Persistence;

namespace FlowPro.Api.Development;

internal static class DevelopmentEndpoints
{
    public static IEndpointRouteBuilder MapDevelopmentEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost(
                "/api/v1/development/reset-attendance",
                async (
                    DatabaseInitializer initializer,
                    CancellationToken cancellationToken) =>
                {
                    await initializer.ResetDevelopmentWorkflowDataAsync(cancellationToken);
                    return Results.NoContent();
                })
            .WithTags("Development")
            .RequireAuthorization();

        endpoints.MapPost(
                "/api/v1/development/reset-qa-scenario",
                async (
                    DatabaseInitializer initializer,
                    CancellationToken cancellationToken) =>
                {
                    await initializer.ResetDevelopmentWorkflowDataAsync(cancellationToken);
                    return Results.NoContent();
                })
            .WithTags("Development")
            .RequireAuthorization();

        return endpoints;
    }
}
