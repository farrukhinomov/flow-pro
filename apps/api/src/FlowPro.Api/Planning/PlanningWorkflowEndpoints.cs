using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Planning;

namespace FlowPro.Api.Planning;

internal static class PlanningWorkflowEndpoints
{
    public static IEndpointRouteBuilder MapPlanningWorkflowEndpoints(this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder group = endpoints
            .MapGroup("/api/v1/planning-workflows")
            .WithTags("Planning Workflows");

        group.MapGet(
                "/{periodMonth}",
                (
                    string periodMonth,
                    IQueryHandler<GetPlanningPackageQuery, PlanningPackageDto> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new GetPlanningPackageQuery(periodMonth),
                        cancellationToken))
            .RequireAuthorization(PermissionKeys.RequestsApprove);

        return endpoints;
    }
}
