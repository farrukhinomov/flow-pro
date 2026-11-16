using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Sync;

namespace FlowPro.Api.Sync;

internal static class SyncEndpoints
{
    public static IEndpointRouteBuilder MapSyncEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet(
                "/api/v1/sync/changes",
                (
                    long? after,
                    int? limit,
                    IQueryHandler<ListSyncChangesQuery, SyncPage> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new ListSyncChangesQuery(after ?? 0, limit ?? 100),
                        cancellationToken))
            .WithTags("Synchronization")
            .RequireAuthorization(PermissionKeys.SyncReadSelf);

        endpoints.MapPost(
                "/api/v1/sync/batches",
                (
                    SubmitSyncBatchCommand command,
                    ICommandHandler<SubmitSyncBatchCommand, SyncBatchResponse> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(command, cancellationToken))
            .WithTags("Synchronization")
            .RequireAuthorization(PermissionKeys.SyncWriteSelf);

        return endpoints;
    }
}
