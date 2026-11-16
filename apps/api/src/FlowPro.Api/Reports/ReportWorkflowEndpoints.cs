using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Reports;

namespace FlowPro.Api.Reports;

internal static class ReportWorkflowEndpoints
{
    public static IEndpointRouteBuilder MapReportWorkflowEndpoints(this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder group = endpoints
            .MapGroup("/api/v1/report-workflows")
            .WithTags("Report Workflows");

        group.MapGet(
                "/{periodMonth}",
                (
                    string periodMonth,
                    IQueryHandler<GetReportsPackageQuery, ReportsPackageDto> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new GetReportsPackageQuery(periodMonth),
                        cancellationToken))
            .RequireAuthorization(PermissionKeys.PayrollExportsManage);

        return endpoints;
    }
}
