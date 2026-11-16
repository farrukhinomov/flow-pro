using FlowPro.Domain.Common;

namespace FlowPro.Domain.Timesheets;

public sealed class MonthlyTimesheetSnapshot : ITrackedEntity
{
    private MonthlyTimesheetSnapshot()
    {
    }

    public MonthlyTimesheetSnapshot(
        Guid tenantId,
        Guid employeeUserId,
        string employeeExternalId,
        string periodMonth,
        string snapshotJson,
        string snapshotHash)
    {
        Id = Guid.CreateVersion7();
        TenantId = tenantId;
        EmployeeUserId = employeeUserId;
        EmployeeExternalId = Guard.Required(employeeExternalId, nameof(employeeExternalId), 200);
        PeriodMonth = Guard.Required(periodMonth, nameof(periodMonth), 7);
        SnapshotJson = Guard.Required(snapshotJson, nameof(snapshotJson), 200_000);
        SnapshotHash = Guard.Required(snapshotHash, nameof(snapshotHash), 128);
        Status = "open";
        Version = 1;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid EmployeeUserId { get; private set; }

    public string EmployeeExternalId { get; private set; } = string.Empty;

    public string PeriodMonth { get; private set; } = string.Empty;

    public string Status { get; private set; } = "open";

    public Guid? SignedByUserId { get; private set; }

    public string? SignedByExternalId { get; private set; }

    public string? SignedByName { get; private set; }

    public DateTimeOffset? SignedAt { get; private set; }

    public string? Note { get; private set; }

    public DateTimeOffset? PayrollExportedAt { get; private set; }

    public DateTimeOffset? PdfExportedAt { get; private set; }

    public string SnapshotJson { get; private set; } = string.Empty;

    public string SnapshotHash { get; private set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public long Version { get; private set; }

    public void Sign(
        Guid signedByUserId,
        string signedByExternalId,
        string signedByName,
        DateTimeOffset signedAt,
        string? note,
        string snapshotJson,
        string snapshotHash)
    {
        if (Status == "signed")
        {
            return;
        }

        Status = "signed";
        SignedByUserId = signedByUserId;
        SignedByExternalId = Guard.Required(signedByExternalId, nameof(signedByExternalId), 200);
        SignedByName = Guard.Required(signedByName, nameof(signedByName), 200);
        SignedAt = signedAt;
        Note = string.IsNullOrWhiteSpace(note) ? null : Guard.Required(note, nameof(note), 1_000);
        SnapshotJson = Guard.Required(snapshotJson, nameof(snapshotJson), 200_000);
        SnapshotHash = Guard.Required(snapshotHash, nameof(snapshotHash), 128);
        Version++;
    }

    public void Reopen()
    {
        if (Status == "open")
        {
            return;
        }

        Status = "open";
        SignedByUserId = null;
        SignedByExternalId = null;
        SignedByName = null;
        SignedAt = null;
        Version++;
    }

    public void MarkExported(string kind, DateTimeOffset exportedAt)
    {
        if (kind == "payroll")
        {
            PayrollExportedAt = exportedAt;
        }
        else if (kind == "pdf")
        {
            PdfExportedAt = exportedAt;
        }
        else
        {
            throw new ArgumentOutOfRangeException(nameof(kind), "Unsupported timesheet export kind.");
        }

        Version++;
    }
}
