using FlowPro.Application.Common;

namespace FlowPro.Application.Payroll;

public sealed record CreatePayrollExportArtifactCommand(
    string PeriodMonth,
    string Kind,
    string? EmployeeId,
    string? Locale) : ICommand<PayrollExportArtifactDto>;

public sealed record ListPayrollExportArtifactsQuery(
    string? PeriodMonth,
    int Limit = 50) : IQuery<PayrollExportArtifactPage>;

public sealed record DownloadPayrollExportArtifactQuery(string ArtifactId) : IQuery<DownloadedPayrollExportArtifact>;

public sealed record PayrollExportArtifactDto(
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
    string Status,
    string ServerVersion);

public sealed record PayrollExportArtifactPage(IReadOnlyList<PayrollExportArtifactDto> Items);

public sealed record DownloadedPayrollExportArtifact(
    PayrollExportArtifactDto Artifact,
    Stream Content);
