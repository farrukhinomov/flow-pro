using FlowPro.Application.Audit;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;

namespace FlowPro.Api.Audit;

internal static class AuditWorkflowEndpoints
{
    public static IEndpointRouteBuilder MapAuditWorkflowEndpoints(this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder group = endpoints
            .MapGroup("/api/v1/audit-events")
            .WithTags("Audit");

        group.MapGet(
                "",
                (
                    string? cursor,
                    int? limit,
                    string? aggregateType,
                    Guid? actorUserId,
                    string? action,
                    string? search,
                    IQueryHandler<ListAuditEventsQuery, AuditEventPage> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new ListAuditEventsQuery(
                            new CursorPageRequest(cursor, limit ?? CursorPageRequest.DefaultLimit),
                            string.IsNullOrWhiteSpace(aggregateType)
                            && actorUserId is null
                            && string.IsNullOrWhiteSpace(action)
                            && string.IsNullOrWhiteSpace(search)
                                ? null
                                : new AuditEventFilter(aggregateType, actorUserId, action, search)),
                        cancellationToken))
            .RequireAuthorization(PermissionKeys.AuditViewFull);

        return endpoints;
    }
}
