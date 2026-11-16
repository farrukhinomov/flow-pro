using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using FlowPro.Application.Audit;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Integration;
using FlowPro.Application.Sync;
using FlowPro.Domain.Audit;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Integration;
using FlowPro.Domain.Sync;
using FlowPro.Domain.Timesheets;

namespace FlowPro.Application.Timesheets;

public sealed class TimesheetWorkflowHandler(
    ICurrentRequestContext requestContext,
    IPermissionChecker permissionChecker,
    ITimesheetWorkflowRepository repository,
    IOutboxWriter outboxWriter,
    IAuditWriter auditWriter,
    ISyncAggregateRepository aggregateRepository,
    IUnitOfWork unitOfWork,
    TimeProvider timeProvider) :
    IQueryHandler<GetMonthlyTimesheetQuery, MonthlyTimesheetApprovalDto>,
    ICommandHandler<SignMonthlyTimesheetCommand, MonthlyTimesheetApprovalDto>,
    ICommandHandler<ReopenMonthlyTimesheetCommand, MonthlyTimesheetApprovalDto>,
    ICommandHandler<MarkTimesheetExportedCommand, MonthlyTimesheetApprovalDto>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<MonthlyTimesheetApprovalDto> HandleAsync(
        GetMonthlyTimesheetQuery query,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        ValidatePeriod(query.PeriodMonth);
        Membership employee = await GetEmployeeAsync(
            identity.TenantId,
            query.EmployeeId,
            cancellationToken);
        await RequireTimesheetAccessAsync(identity, employee, cancellationToken);

        MonthlyTimesheetSnapshot? snapshot = await repository.FindSnapshotAsync(
            identity.TenantId,
            employee.ExternalSubject,
            query.PeriodMonth,
            cancellationToken);

        return snapshot is null
            ? BuildOpenApproval(employee.ExternalSubject, query.PeriodMonth, timeProvider.GetUtcNow())
            : Map(snapshot);
    }

    public async Task<MonthlyTimesheetApprovalDto> HandleAsync(
        SignMonthlyTimesheetCommand command,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        ValidatePeriod(command.PeriodMonth);
        await RequireManageAsync(identity, cancellationToken);

        return await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                Membership employee = await GetEmployeeAsync(
                    identity.TenantId,
                    command.EmployeeId,
                    transactionCancellationToken);
                Membership signer = await GetCurrentUserAsync(
                    identity.TenantId,
                    identity.UserId,
                    transactionCancellationToken);
                DateTimeOffset now = timeProvider.GetUtcNow();
                string snapshotJson = BuildSnapshotJson(command.Snapshot);
                string snapshotHash = ComputeSha256(snapshotJson);

                MonthlyTimesheetSnapshot? snapshot = await repository.FindSnapshotAsync(
                    identity.TenantId,
                    employee.ExternalSubject,
                    command.PeriodMonth,
                    transactionCancellationToken);
                if (snapshot is null)
                {
                    snapshot = new MonthlyTimesheetSnapshot(
                        identity.TenantId,
                        employee.Id,
                        employee.ExternalSubject,
                        command.PeriodMonth,
                        snapshotJson,
                        snapshotHash);
                    repository.AddSnapshot(snapshot);
                }

                snapshot.Sign(
                    signer.Id,
                    signer.ExternalSubject,
                    signer.DisplayName,
                    now,
                    command.Note,
                    snapshotJson,
                    snapshotHash);

                MonthlyTimesheetApprovalDto approval = Map(snapshot, now);
                await AddCompatibilityAggregateAsync(
                    identity,
                    employee.Id,
                    approval,
                    "timesheet.sign",
                    now,
                    transactionCancellationToken);
                AddAuditAndOutbox(identity, approval.Id, "timesheet.signed.v1", approval, now);

                return approval;
            },
            cancellationToken);
    }

    public async Task<MonthlyTimesheetApprovalDto> HandleAsync(
        ReopenMonthlyTimesheetCommand command,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        ValidatePeriod(command.PeriodMonth);
        await RequireManageAsync(identity, cancellationToken);

        return await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                Membership employee = await GetEmployeeAsync(
                    identity.TenantId,
                    command.EmployeeId,
                    transactionCancellationToken);
                MonthlyTimesheetSnapshot snapshot = await repository.FindSnapshotAsync(
                        identity.TenantId,
                        employee.ExternalSubject,
                        command.PeriodMonth,
                        transactionCancellationToken)
                    ?? throw new FlowProNotFoundException(
                        "timesheet.not_found",
                        "Timesheet snapshot was not found.");
                DateTimeOffset now = timeProvider.GetUtcNow();

                snapshot.Reopen();
                MonthlyTimesheetApprovalDto approval = Map(snapshot, now);
                await AddCompatibilityAggregateAsync(
                    identity,
                    employee.Id,
                    approval,
                    "timesheet.reopen",
                    now,
                    transactionCancellationToken);
                AddAuditAndOutbox(
                    identity,
                    approval.Id,
                    "timesheet.reopened.v1",
                    new { approval, command.Reason },
                    now);

                return approval;
            },
            cancellationToken);
    }

    public async Task<MonthlyTimesheetApprovalDto> HandleAsync(
        MarkTimesheetExportedCommand command,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        ValidatePeriod(command.PeriodMonth);
        await RequirePayrollExportAsync(identity, cancellationToken);

        return await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                Membership employee = await GetEmployeeAsync(
                    identity.TenantId,
                    command.EmployeeId,
                    transactionCancellationToken);
                MonthlyTimesheetSnapshot snapshot = await repository.FindSnapshotAsync(
                        identity.TenantId,
                        employee.ExternalSubject,
                        command.PeriodMonth,
                        transactionCancellationToken)
                    ?? throw new FlowProNotFoundException(
                        "timesheet.not_found",
                        "Timesheet snapshot was not found.");
                string kind = NormalizeExportKind(command.Kind);
                DateTimeOffset now = timeProvider.GetUtcNow();

                snapshot.MarkExported(kind, now);
                MonthlyTimesheetApprovalDto approval = Map(snapshot, now);
                await AddCompatibilityAggregateAsync(
                    identity,
                    employee.Id,
                    approval,
                    "timesheet.export",
                    now,
                    transactionCancellationToken);
                AddAuditAndOutbox(identity, approval.Id, "timesheet.exported.v1", new { approval, kind }, now);

                return approval;
            },
            cancellationToken);
    }

    private async Task<Membership> GetEmployeeAsync(
        Guid tenantId,
        string externalId,
        CancellationToken cancellationToken) =>
        await repository.FindUserAsync(tenantId, externalId, cancellationToken)
            ?? throw new FlowProNotFoundException("timesheet.employee_not_found", "Timesheet employee was not found.");

    private async Task<Membership> GetCurrentUserAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken) =>
        await repository.FindUserByIdAsync(tenantId, userId, cancellationToken)
            ?? throw new FlowProUnauthorizedException();

    private async Task RequireTimesheetAccessAsync(
        RequestIdentity identity,
        Membership employee,
        CancellationToken cancellationToken)
    {
        if (identity.UserId == employee.Id
            && await permissionChecker.HasPermissionAsync(
                identity.TenantId,
                identity.UserId,
                PermissionKeys.TimesheetsWriteSelf,
                cancellationToken))
        {
            return;
        }

        await RequireManageAsync(identity, cancellationToken);
    }

    private async Task RequireManageAsync(RequestIdentity identity, CancellationToken cancellationToken)
    {
        bool allowed = await permissionChecker.HasPermissionAsync(
            identity.TenantId,
            identity.UserId,
            PermissionKeys.TimesheetsManage,
            cancellationToken);

        if (!allowed)
        {
            throw new FlowProForbiddenException(
                "timesheets.manage_required",
                "Managing timesheets requires the timesheets.manage permission.");
        }
    }

    private async Task RequirePayrollExportAsync(RequestIdentity identity, CancellationToken cancellationToken)
    {
        bool allowed = await permissionChecker.HasPermissionAsync(
            identity.TenantId,
            identity.UserId,
            PermissionKeys.PayrollExportsManage,
            cancellationToken);

        if (!allowed)
        {
            throw new FlowProForbiddenException(
                "payroll_exports.manage_required",
                "Exporting timesheets requires the payroll-exports.manage permission.");
        }
    }

    private async Task AddCompatibilityAggregateAsync(
        RequestIdentity identity,
        Guid ownerUserId,
        MonthlyTimesheetApprovalDto approval,
        string operationType,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        string payloadJson = JsonSerializer.Serialize(approval, JsonOptions);
        ClientAggregate? current = await aggregateRepository.FindAsync(
            identity.TenantId,
            "timesheet",
            approval.Id,
            cancellationToken);
        string operationId = $"api-{operationType}-{approval.Id}-{now:yyyyMMddHHmmssfffffff}";

        if (current is null)
        {
            current = new ClientAggregate(
                identity.TenantId,
                "timesheet",
                approval.Id,
                payloadJson,
                operationId,
                now,
                ownerUserId);
            aggregateRepository.Add(current);
        }
        else
        {
            current.Upsert(payloadJson, operationId, now);
        }
    }

    private void AddAuditAndOutbox(
        RequestIdentity identity,
        string aggregateId,
        string eventType,
        object payload,
        DateTimeOffset now)
    {
        string payloadJson = JsonSerializer.Serialize(payload, JsonOptions);
        Guid stableId = StableGuid($"timesheet:{aggregateId}");

        outboxWriter.Add(
            new OutboxMessage(
                identity.TenantId,
                eventType,
                "timesheet",
                stableId,
                payloadJson,
                now));
        auditWriter.Add(
            new AuditEvent(
                identity.TenantId,
                identity.UserId,
                eventType,
                "timesheet",
                stableId,
                payloadJson,
                now));
    }

    private static MonthlyTimesheetApprovalDto BuildOpenApproval(
        string employeeId,
        string periodMonth,
        DateTimeOffset now) =>
        new(
            $"{employeeId}-{periodMonth}",
            employeeId,
            periodMonth,
            "open",
            null,
            null,
            null,
            null,
            null,
            null,
            now);

    private static MonthlyTimesheetApprovalDto Map(MonthlyTimesheetSnapshot snapshot) =>
        Map(snapshot, snapshot.UpdatedAt);

    private static MonthlyTimesheetApprovalDto Map(MonthlyTimesheetSnapshot snapshot, DateTimeOffset updatedAt) =>
        new(
            $"{snapshot.EmployeeExternalId}-{snapshot.PeriodMonth}",
            snapshot.EmployeeExternalId,
            snapshot.PeriodMonth,
            snapshot.Status,
            snapshot.SignedByExternalId,
            snapshot.SignedByName,
            snapshot.SignedAt,
            snapshot.Note,
            snapshot.PayrollExportedAt,
            snapshot.PdfExportedAt,
            updatedAt);

    private static string BuildSnapshotJson(TimesheetSnapshotDto? snapshot) =>
        JsonSerializer.Serialize(
            new
            {
                totals = snapshot?.Totals,
                rows = snapshot?.Rows,
            },
            JsonOptions);

    private static string ComputeSha256(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();

    private static void ValidatePeriod(string periodMonth)
    {
        if (periodMonth.Length != 7
            || periodMonth[4] != '-'
            || !int.TryParse(periodMonth[..4], out int year)
            || !int.TryParse(periodMonth[5..], out int month)
            || year < 2000
            || month is < 1 or > 12)
        {
            throw new FlowProValidationException(
                "timesheet.period.invalid",
                "Timesheet period must use yyyy-MM format.");
        }
    }

    private static string NormalizeExportKind(string kind) =>
        kind.Trim().ToLowerInvariant() switch
        {
            "payroll" => "payroll",
            "pdf" => "pdf",
            _ => throw new FlowProValidationException(
                "timesheet.export_kind.invalid",
                "Timesheet export kind must be payroll or pdf."),
        };

    private static Guid StableGuid(string value)
    {
        byte[] hash = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        Span<byte> bytes = stackalloc byte[16];
        hash.AsSpan(0, 16).CopyTo(bytes);
        return new Guid(bytes);
    }
}
