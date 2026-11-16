using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Organization;

namespace FlowPro.Api.Organization;

internal static class EmploymentContractWorkflowEndpoints
{
    public static IEndpointRouteBuilder MapEmploymentContractWorkflowEndpoints(this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder group = endpoints
            .MapGroup("/api/v1/directory/employment-contracts")
            .WithTags("Organization");

        group.MapGet(
                "",
                (
                    string? employeeId,
                    IQueryHandler<ListEmploymentContractsQuery, EmploymentContractPage> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(new ListEmploymentContractsQuery(employeeId), cancellationToken))
            .RequireAuthorization(PermissionKeys.OrganizationManage);

        group.MapPut(
                "/{contractId:guid}",
                (
                    Guid contractId,
                    EmploymentContractDto request,
                    ICommandHandler<SaveEmploymentContractCommand, EmploymentContractDto> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new SaveEmploymentContractCommand(request with { Id = contractId }),
                        cancellationToken))
            .RequireAuthorization(PermissionKeys.OrganizationManage);

        group.MapPost(
                "",
                (
                    EmploymentContractDto request,
                    ICommandHandler<SaveEmploymentContractCommand, EmploymentContractDto> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new SaveEmploymentContractCommand(request with { Id = null }),
                        cancellationToken))
            .RequireAuthorization(PermissionKeys.OrganizationManage);

        return endpoints;
    }
}
