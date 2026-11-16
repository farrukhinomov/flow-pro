using System.Globalization;
using System.Text;
using System.Text.Json;
using FlowPro.Application.Attachments;
using FlowPro.Application.Audit;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Integration;
using FlowPro.Application.Reports;
using FlowPro.Application.Sync;
using FlowPro.Domain.Audit;
using FlowPro.Domain.Integration;
using FlowPro.Domain.Sync;

namespace FlowPro.Application.Payroll;

public sealed class PayrollExportArtifactHandler(
    ICurrentRequestContext requestContext,
    IPermissionChecker permissionChecker,
    IQueryHandler<GetReportsPackageQuery, ReportsPackageDto> reportsHandler,
    IAttachmentObjectStore objectStore,
    ISyncAggregateRepository aggregateRepository,
    IOutboxWriter outboxWriter,
    IAuditWriter auditWriter,
    IUnitOfWork unitOfWork,
    TimeProvider timeProvider) :
    ICommandHandler<CreatePayrollExportArtifactCommand, PayrollExportArtifactDto>,
    IQueryHandler<ListPayrollExportArtifactsQuery, PayrollExportArtifactPage>,
    IQueryHandler<DownloadPayrollExportArtifactQuery, DownloadedPayrollExportArtifact>
{
    private const string AggregateType = "payroll-export-artifact";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<PayrollExportArtifactDto> HandleAsync(
        CreatePayrollExportArtifactCommand command,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        await RequirePayrollExportAccessAsync(identity, cancellationToken);

        string periodMonth = NormalizePeriodMonth(command.PeriodMonth);
        string kind = NormalizeKind(command.Kind);
        string locale = string.IsNullOrWhiteSpace(command.Locale) ? "en" : command.Locale.Trim();
        ReportsPackageDto report = await reportsHandler.HandleAsync(
            new GetReportsPackageQuery(periodMonth),
            cancellationToken);
        ReportsPackageDto scopedReport = ScopeReport(report, command.EmployeeId);
        ArtifactContent artifactContent = BuildArtifactContent(scopedReport, kind, locale);
        string artifactId = Guid.CreateVersion7().ToString();
        await using MemoryStream content = new(artifactContent.Bytes, writable: false);
        StoredAttachmentObject stored = await objectStore.PutAsync(
            new AttachmentObjectWriteRequest(
                identity.TenantId,
                identity.UserId,
                artifactId,
                artifactContent.FileName,
                artifactContent.ContentType,
                artifactContent.Bytes.LongLength,
                content),
            cancellationToken);

        return await unitOfWork.ExecuteAsync(
            transactionCancellationToken =>
                StoreArtifactAsync(
                    identity,
                    artifactId,
                    periodMonth,
                    kind,
                    command.EmployeeId,
                    artifactContent,
                    stored,
                    transactionCancellationToken),
            cancellationToken);
    }

    public async Task<PayrollExportArtifactPage> HandleAsync(
        ListPayrollExportArtifactsQuery query,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        await RequirePayrollExportAccessAsync(identity, cancellationToken);

        IReadOnlyList<ClientAggregate> aggregates = await aggregateRepository.ListAsync(
            identity.TenantId,
            AggregateType,
            offset: 0,
            Math.Clamp(query.Limit, 1, 200),
            includeDeleted: false,
            ownerUserId: null,
            ownerOnly: false,
            cancellationToken);
        PayrollExportArtifactDto[] artifacts = aggregates
            .Select(MapArtifact)
            .Where(artifact => string.IsNullOrWhiteSpace(query.PeriodMonth)
                || artifact.PeriodMonth == query.PeriodMonth.Trim())
            .OrderByDescending(artifact => artifact.GeneratedAt)
            .ToArray();

        return new PayrollExportArtifactPage(artifacts);
    }

    public async Task<DownloadedPayrollExportArtifact> HandleAsync(
        DownloadPayrollExportArtifactQuery query,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        await RequirePayrollExportAccessAsync(identity, cancellationToken);

        ClientAggregate aggregate = await aggregateRepository.FindAsync(
                identity.TenantId,
                AggregateType,
                query.ArtifactId,
                cancellationToken)
            ?? throw new FlowProNotFoundException(
                "payroll_export_artifact.not_found",
                "The requested payroll export artifact was not found.");

        if (aggregate.IsDeleted)
        {
            throw new FlowProNotFoundException(
                "payroll_export_artifact.not_found",
                "The requested payroll export artifact was not found.");
        }

        PayrollExportArtifactDto artifact = MapArtifact(aggregate);
        Stream content = await objectStore.OpenReadAsync(
            new AttachmentObjectReadRequest(artifact.ObjectKey),
            cancellationToken);
        DateTimeOffset now = timeProvider.GetUtcNow();
        await unitOfWork.ExecuteAsync(
            _ =>
            {
                AddAuditAndOutbox(identity, artifact.Id, "payroll_export_artifact.downloaded.v1", artifact, now);
                return Task.FromResult(true);
            },
            cancellationToken);

        return new DownloadedPayrollExportArtifact(artifact, content);
    }

    private async Task<PayrollExportArtifactDto> StoreArtifactAsync(
        RequestIdentity identity,
        string artifactId,
        string periodMonth,
        string kind,
        string? employeeId,
        ArtifactContent artifactContent,
        StoredAttachmentObject stored,
        CancellationToken cancellationToken)
    {
        DateTimeOffset now = timeProvider.GetUtcNow();
        PayrollExportArtifactPayload payload = new(
            artifactId,
            periodMonth,
            kind,
            string.IsNullOrWhiteSpace(employeeId) ? null : employeeId.Trim(),
            artifactContent.FileName,
            artifactContent.ContentType,
            stored.SizeBytes,
            stored.Sha256,
            stored.ObjectKey,
            stored.StorageProvider,
            identity.UserId.ToString(),
            now,
            "ready");
        string payloadJson = JsonSerializer.Serialize(payload, JsonOptions);
        ClientAggregate? existing = await aggregateRepository.FindAsync(
            identity.TenantId,
            AggregateType,
            artifactId,
            cancellationToken);

        if (existing is null)
        {
            existing = new ClientAggregate(
                identity.TenantId,
                AggregateType,
                artifactId,
                payloadJson,
                $"payroll-export-artifact-{artifactId}",
                now,
                ownerUserId: null);
            aggregateRepository.Add(existing);
        }
        else
        {
            existing.Upsert(payloadJson, $"payroll-export-artifact-{artifactId}", now);
        }

        PayrollExportArtifactDto artifact = MapArtifact(existing, payload);
        AddAuditAndOutbox(identity, artifact.Id, "payroll_export_artifact.generated.v1", artifact, now);

        return artifact;
    }

    private async Task RequirePayrollExportAccessAsync(
        RequestIdentity identity,
        CancellationToken cancellationToken)
    {
        bool allowed = await permissionChecker.HasPermissionAsync(
            identity.TenantId,
            identity.UserId,
            PermissionKeys.PayrollExportsManage,
            cancellationToken);

        if (!allowed)
        {
            throw new FlowProForbiddenException(
                "payroll_export_artifact.manage_required",
                "Payroll export artifacts require the payroll-exports.manage permission.");
        }
    }

    private void AddAuditAndOutbox(
        RequestIdentity identity,
        string artifactId,
        string eventType,
        PayrollExportArtifactDto artifact,
        DateTimeOffset now)
    {
        string payload = JsonSerializer.Serialize(artifact, JsonOptions);
        outboxWriter.Add(
            new OutboxMessage(
                identity.TenantId,
                eventType,
                AggregateType,
                Guid.Parse(artifactId),
                payload,
                now));
        auditWriter.Add(
            new AuditEvent(
                identity.TenantId,
                identity.UserId,
                eventType,
                AggregateType,
                Guid.Parse(artifactId),
                payload,
                now));
    }

    private static ReportsPackageDto ScopeReport(ReportsPackageDto report, string? employeeId)
    {
        if (string.IsNullOrWhiteSpace(employeeId))
        {
            return report;
        }

        string scopedEmployeeId = employeeId.Trim();
        EmployeePayrollReportDto[] employeeReports = report.EmployeeReports
            .Where(item => item.Employee.Id == scopedEmployeeId)
            .ToArray();

        return report with
        {
            AbsenceBalances = report.AbsenceBalances
                .Where(item => item.EmployeeId == scopedEmployeeId)
                .ToArray(),
            EmployeeReports = employeeReports,
            TeamReports = BuildScopedTeamReports(employeeReports),
        };
    }

    private static TeamReportDto[] BuildScopedTeamReports(IReadOnlyList<EmployeePayrollReportDto> employeeReports) =>
        employeeReports
            .GroupBy(item => item.Employee.Team)
            .Select(group => new TeamReportDto(
                group.Key,
                group.Count(),
                group.Count(item => item.Approval?.Status == "signed"),
                group.Count(item => item.Approval?.Status != "signed"),
                group.Sum(item => item.Totals.WorkedHours),
                group.Sum(item => item.Totals.TargetHours),
                group.Sum(item => item.Totals.FlexHours),
                group.Sum(item => item.Totals.ComplianceIssues),
                0))
            .ToArray();

    private static ArtifactContent BuildArtifactContent(ReportsPackageDto report, string kind, string locale)
    {
        string content = kind switch
        {
            "payroll" => BuildPayrollCsv(report),
            "balances" => BuildAbsenceBalanceCsv(report),
            "teams" => BuildTeamCsv(report),
            "excel" => BuildExcelHtml(report, locale),
            "pdf" => BuildPdfHtml(report, locale),
            _ => throw new FlowProValidationException(
                "payroll_export_artifact.kind_invalid",
                "Payroll export artifact kind is not supported."),
        };
        string extension = kind switch
        {
            "excel" => "xls",
            "pdf" => "html",
            _ => "csv",
        };
        string contentType = kind switch
        {
            "excel" => "application/vnd.ms-excel;charset=utf-8",
            "pdf" => "text/html;charset=utf-8",
            _ => "text/csv;charset=utf-8",
        };

        return new ArtifactContent(
            $"flowpro-{kind}-{report.PeriodMonth}.{extension}",
            contentType,
            Encoding.UTF8.GetBytes(content));
    }

    private static string BuildPayrollCsv(ReportsPackageDto report)
    {
        string[] header =
        [
            "Employee ID",
            "Employee",
            "Period",
            "Date",
            "Status",
            "Worked hours",
            "Paid hours",
            "Target hours",
            "Flex hours",
            "Break hours",
            "Required break hours",
            "Break compliant",
            "Approval status",
            "Signed at",
        ];
        IEnumerable<string[]> rows = report.EmployeeReports
            .SelectMany(employeeReport => employeeReport.Days.Select(day => new[]
            {
                day.EmployeeId,
                day.EmployeeName,
                report.PeriodMonth,
                day.Date,
                day.Status,
                FormatNumber(day.WorkedHours),
                FormatNumber(day.PaidHours),
                FormatNumber(day.TargetHours),
                FormatNumber(day.FlexHours),
                FormatNumber(day.BreakHours),
                FormatNumber(day.BreakRequiredHours),
                day.BreakCompliant ? "true" : "false",
                employeeReport.Approval?.Status ?? "open",
                employeeReport.Approval?.SignedAt?.ToString("O", CultureInfo.InvariantCulture) ?? string.Empty,
            }));

        return BuildCsv(header, rows);
    }

    private static string BuildAbsenceBalanceCsv(ReportsPackageDto report)
    {
        string[] header =
        [
            "Employee ID",
            "Employee",
            "Annual vacation days",
            "Approved vacation days",
            "Planned vacation days",
            "Remaining vacation days",
            "Sickness days",
            "Home office days",
        ];
        IEnumerable<string[]> rows = report.AbsenceBalances.Select(balance => new[]
        {
            balance.EmployeeId,
            balance.EmployeeName,
            FormatNumber(balance.AnnualVacationDays),
            FormatNumber(balance.ApprovedVacationDays),
            FormatNumber(balance.PlannedVacationDays),
            FormatNumber(balance.RemainingVacationDays),
            FormatNumber(balance.SicknessDays),
            FormatNumber(balance.HomeOfficeDays),
        });

        return BuildCsv(header, rows);
    }

    private static string BuildTeamCsv(ReportsPackageDto report)
    {
        string[] header =
        [
            "Team",
            "Headcount",
            "Signed periods",
            "Open periods",
            "Worked hours",
            "Target hours",
            "Flex hours",
            "Compliance issues",
            "Approved absence days",
        ];
        IEnumerable<string[]> rows = report.TeamReports.Select(team => new[]
        {
            team.Team,
            team.Headcount.ToString(CultureInfo.InvariantCulture),
            team.SignedPeriods.ToString(CultureInfo.InvariantCulture),
            team.OpenPeriods.ToString(CultureInfo.InvariantCulture),
            FormatNumber(team.WorkedHours),
            FormatNumber(team.TargetHours),
            FormatNumber(team.FlexHours),
            team.ComplianceIssues.ToString(CultureInfo.InvariantCulture),
            FormatNumber(team.ApprovedAbsenceDays),
        });

        return BuildCsv(header, rows);
    }

    private static string BuildExcelHtml(ReportsPackageDto report, string locale) =>
        $$"""
        <!doctype html>
        <html><head><meta charset="utf-8" /></head><body>
        <table>
        <tr><th colspan="9">Payroll {{report.PeriodMonth}}</th></tr>
        <tr><th>Employee</th><th>Date</th><th>Status</th><th>Worked</th><th>Paid</th><th>Target</th><th>Flex</th><th>Break OK</th><th>Approval</th></tr>
        {{string.Join("", report.EmployeeReports.SelectMany(employeeReport => employeeReport.Days.Select(day => $"<tr><td>{Html(day.EmployeeName)}</td><td>{day.Date}</td><td>{Html(day.Status)}</td><td>{FormatNumber(day.WorkedHours)}</td><td>{FormatNumber(day.PaidHours)}</td><td>{FormatNumber(day.TargetHours)}</td><td>{FormatNumber(day.FlexHours)}</td><td>{(day.BreakCompliant ? "Yes" : "No")}</td><td>{employeeReport.Approval?.Status ?? "open"}</td></tr>")))}}
        </table>
        <br />
        <table>
        <tr><th colspan="7">Absence balances</th></tr>
        <tr><th>Employee</th><th>Annual</th><th>Approved</th><th>Planned</th><th>Remaining</th><th>Sickness</th><th>Home office</th></tr>
        {{string.Join("", report.AbsenceBalances.Select(balance => $"<tr><td>{Html(balance.EmployeeName)}</td><td>{FormatNumber(balance.AnnualVacationDays)}</td><td>{FormatNumber(balance.ApprovedVacationDays)}</td><td>{FormatNumber(balance.PlannedVacationDays)}</td><td>{FormatNumber(balance.RemainingVacationDays)}</td><td>{FormatNumber(balance.SicknessDays)}</td><td>{FormatNumber(balance.HomeOfficeDays)}</td></tr>"))}}
        </table>
        <br />
        <table>
        <tr><th colspan="8">Team report</th></tr>
        <tr><th>Team</th><th>Headcount</th><th>Signed</th><th>Open</th><th>Worked</th><th>Target</th><th>Flex</th><th>Compliance issues</th></tr>
        {{string.Join("", report.TeamReports.Select(team => $"<tr><td>{Html(team.Team)}</td><td>{team.Headcount}</td><td>{team.SignedPeriods}</td><td>{team.OpenPeriods}</td><td>{FormatNumber(team.WorkedHours)}</td><td>{FormatNumber(team.TargetHours)}</td><td>{FormatNumber(team.FlexHours)}</td><td>{team.ComplianceIssues}</td></tr>"))}}
        </table>
        </body></html>
        """;

    private static string BuildPdfHtml(ReportsPackageDto report, string locale)
    {
        PayrollReportTotalsDto totals = report.EmployeeReports.Aggregate(
            new PayrollReportTotalsDto(0, 0, 0, 0, 0, 0),
            (sum, employeeReport) => new PayrollReportTotalsDto(
                sum.WorkedHours + employeeReport.Totals.WorkedHours,
                sum.PaidHours + employeeReport.Totals.PaidHours,
                sum.TargetHours + employeeReport.Totals.TargetHours,
                sum.FlexHours + employeeReport.Totals.FlexHours,
                sum.BreakHours + employeeReport.Totals.BreakHours,
                sum.ComplianceIssues + employeeReport.Totals.ComplianceIssues));

        return $$"""
        <!doctype html>
        <html>
        <head>
        <meta charset="utf-8" />
        <title>FlowPro Reports {{report.PeriodMonth}}</title>
        <style>
        body { font-family: Inter, Arial, sans-serif; margin: 32px; color: #111827; }
        h1 { font-size: 24px; margin: 0 0 4px; }
        h2 { font-size: 16px; margin: 28px 0 8px; }
        .muted { color: #6b7280; }
        .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin: 24px 0; }
        .metric { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
        .metric div:first-child { color: #6b7280; font-size: 12px; }
        .metric div:last-child { font-size: 18px; font-weight: 700; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border-bottom: 1px solid #e5e7eb; padding: 8px; text-align: right; }
        th:first-child, td:first-child { text-align: left; }
        th { background: #f9fafb; color: #4b5563; }
        </style>
        </head>
        <body>
        <h1>FlowPro Reports</h1>
        <div class="muted">{{report.PeriodMonth}} · Generated {{report.GeneratedAt.ToString("u", CultureInfo.InvariantCulture)}}</div>
        <div class="grid">
        <div class="metric"><div>Worked</div><div>{{FormatNumber(totals.WorkedHours)}}</div></div>
        <div class="metric"><div>Paid</div><div>{{FormatNumber(totals.PaidHours)}}</div></div>
        <div class="metric"><div>Target</div><div>{{FormatNumber(totals.TargetHours)}}</div></div>
        <div class="metric"><div>Flex</div><div>{{FormatNumber(totals.FlexHours)}}</div></div>
        <div class="metric"><div>Break issues</div><div>{{totals.ComplianceIssues}}</div></div>
        </div>
        <h2>Team report</h2>
        <table><thead><tr><th>Team</th><th>Headcount</th><th>Signed</th><th>Open</th><th>Worked</th><th>Target</th><th>Flex</th><th>Break issues</th></tr></thead><tbody>
        {{string.Join("", report.TeamReports.Select(team => $"<tr><td>{Html(team.Team)}</td><td>{team.Headcount}</td><td>{team.SignedPeriods}</td><td>{team.OpenPeriods}</td><td>{FormatNumber(team.WorkedHours)}</td><td>{FormatNumber(team.TargetHours)}</td><td>{FormatNumber(team.FlexHours)}</td><td>{team.ComplianceIssues}</td></tr>"))}}
        </tbody></table>
        </body></html>
        """;
    }

    private static string BuildCsv(IReadOnlyList<string> header, IEnumerable<IReadOnlyList<string>> rows) =>
        string.Join('\n', new[] { header }.Concat(rows).Select(row => string.Join(',', row.Select(CsvEscape))));

    private static string CsvEscape(string value) =>
        value.Contains('"', StringComparison.Ordinal) || value.Contains(',', StringComparison.Ordinal) || value.Contains('\n', StringComparison.Ordinal)
            ? $"\"{value.Replace("\"", "\"\"", StringComparison.Ordinal)}\""
            : value;

    private static string Html(string value) =>
        value.Replace("&", "&amp;", StringComparison.Ordinal)
            .Replace("<", "&lt;", StringComparison.Ordinal)
            .Replace(">", "&gt;", StringComparison.Ordinal)
            .Replace("\"", "&quot;", StringComparison.Ordinal);

    private static string FormatNumber(decimal value) =>
        value.ToString("0.00", CultureInfo.InvariantCulture);

    private static PayrollExportArtifactDto MapArtifact(ClientAggregate aggregate) =>
        MapArtifact(
            aggregate,
            JsonSerializer.Deserialize<PayrollExportArtifactPayload>(aggregate.PayloadJson, JsonOptions)
            ?? throw new FlowProValidationException(
                "payroll_export_artifact.metadata_invalid",
                "Payroll export artifact metadata could not be read."));

    private static PayrollExportArtifactDto MapArtifact(
        ClientAggregate aggregate,
        PayrollExportArtifactPayload payload) =>
        new(
            payload.Id,
            payload.PeriodMonth,
            payload.Kind,
            payload.EmployeeId,
            payload.FileName,
            payload.ContentType,
            payload.SizeBytes,
            payload.Sha256,
            payload.ObjectKey,
            payload.StorageProvider,
            payload.RequestedByUserId,
            payload.GeneratedAt,
            payload.Status,
            aggregate.ServerVersion);

    private static string NormalizePeriodMonth(string periodMonth)
    {
        string normalized = periodMonth.Trim();
        if (!DateOnly.TryParseExact(
                $"{normalized}-01",
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out _))
        {
            throw new FlowProValidationException(
                "payroll_export_artifact.period_invalid",
                "Payroll export artifact period must be formatted as yyyy-MM.");
        }

        return normalized;
    }

    private static string NormalizeKind(string kind) =>
        kind.Trim().ToLowerInvariant() switch
        {
            "payroll" => "payroll",
            "balances" => "balances",
            "teams" => "teams",
            "excel" => "excel",
            "pdf" => "pdf",
            _ => throw new FlowProValidationException(
                "payroll_export_artifact.kind_invalid",
                "Payroll export artifact kind must be payroll, balances, teams, excel, or pdf."),
        };

    private sealed record ArtifactContent(string FileName, string ContentType, byte[] Bytes);

    private sealed record PayrollExportArtifactPayload(
        string Id,
        string PeriodMonth,
        string Kind,
        string? EmployeeId,
        string FileName,
        string ContentType,
        long SizeBytes,
        string Sha256,
        string ObjectKey,
        string StorageProvider,
        string RequestedByUserId,
        DateTimeOffset GeneratedAt,
        string Status);
}
