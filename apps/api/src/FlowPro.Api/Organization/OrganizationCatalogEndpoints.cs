using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Organization;

namespace FlowPro.Api.Organization;

internal static class OrganizationCatalogEndpoints
{
    public static IEndpointRouteBuilder MapOrganizationCatalogEndpoints(this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder group = endpoints
            .MapGroup("/api/v1/directory/organization-catalogs")
            .WithTags("Organization");

        group.MapGet(
                "",
                (
                    IQueryHandler<ListOrganizationCatalogQuery, OrganizationCatalogPage> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(new ListOrganizationCatalogQuery(), cancellationToken))
            .RequireAuthorization(PermissionKeys.OrganizationManage);

        group.MapPut(
                "/{recordId}",
                (
                    string recordId,
                    OrganizationCatalogRecordDto request,
                    ICommandHandler<SaveOrganizationCatalogRecordCommand, OrganizationCatalogRecordDto> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new SaveOrganizationCatalogRecordCommand(request with { Id = recordId }),
                        cancellationToken))
            .RequireAuthorization(PermissionKeys.OrganizationManage);

        group.MapPut(
                "/manager-delegations/{managerId}",
                (
                    string managerId,
                    SetManagerDelegationsRequest request,
                    ICommandHandler<SetManagerDelegationsCommand, ManagerDelegationPage> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new SetManagerDelegationsCommand(managerId, request.Teams),
                        cancellationToken))
            .RequireAuthorization(PermissionKeys.OrganizationManage);

        return endpoints;
    }

    private sealed record SetManagerDelegationsRequest(IReadOnlyList<string> Teams);
}
