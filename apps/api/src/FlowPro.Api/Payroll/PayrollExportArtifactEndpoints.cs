using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Payroll;

namespace FlowPro.Api.Payroll;

internal static class PayrollExportArtifactEndpoints
{
    public static IEndpointRouteBuilder MapPayrollExportArtifactEndpoints(this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder group = endpoints
            .MapGroup("/api/v1/payroll-export-artifacts")
            .WithTags("Payroll Export Artifacts");

        group.MapGet(
                "",
                (
                    string? periodMonth,
                    int? limit,
                    IQueryHandler<ListPayrollExportArtifactsQuery, PayrollExportArtifactPage> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new ListPayrollExportArtifactsQuery(periodMonth, limit ?? 50),
                        cancellationToken))
            .RequireAuthorization(PermissionKeys.PayrollExportsManage);

        group.MapPost(
                "",
                (
                    CreatePayrollExportArtifactRequest request,
                    ICommandHandler<CreatePayrollExportArtifactCommand, PayrollExportArtifactDto> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new CreatePayrollExportArtifactCommand(
                            request.PeriodMonth,
                            request.Kind,
                            request.EmployeeId,
                            request.Locale),
                        cancellationToken))
            .RequireAuthorization(PermissionKeys.PayrollExportsManage);

        group.MapGet(
                "/{artifactId}/download",
                async (
                    string artifactId,
                    IQueryHandler<DownloadPayrollExportArtifactQuery, DownloadedPayrollExportArtifact> handler,
                    CancellationToken cancellationToken) =>
                {
                    DownloadedPayrollExportArtifact download = await handler.HandleAsync(
                        new DownloadPayrollExportArtifactQuery(artifactId),
                        cancellationToken);

                    return Results.File(
                        download.Content,
                        download.Artifact.ContentType,
                        download.Artifact.FileName,
                        enableRangeProcessing: true);
                })
            .RequireAuthorization(PermissionKeys.PayrollExportsManage);

        return endpoints;
    }

    private sealed record CreatePayrollExportArtifactRequest(
        string PeriodMonth,
        string Kind,
        string? EmployeeId,
        string? Locale);
}
