using System.Text.Json;
using FlowPro.Application.Audit;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Integration;
using FlowPro.Domain.Audit;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Integration;
using FlowPro.Domain.Organization;

namespace FlowPro.Application.Organization;

public sealed class EmploymentContractWorkflowHandler(
    ICurrentRequestContext requestContext,
    IPermissionChecker permissionChecker,
    IEmploymentContractWorkflowRepository repository,
    IOutboxWriter outboxWriter,
    IAuditWriter auditWriter,
    IUnitOfWork unitOfWork,
    TimeProvider timeProvider) :
    IQueryHandler<ListEmploymentContractsQuery, EmploymentContractPage>,
    ICommandHandler<SaveEmploymentContractCommand, EmploymentContractDto>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<EmploymentContractPage> HandleAsync(
        ListEmploymentContractsQuery query,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        await RequireOrganizationManageAsync(identity, cancellationToken);

        IReadOnlyList<EmploymentContractProjection> contracts = await repository.ListAsync(
            identity.TenantId,
            query.EmployeeId,
            cancellationToken);

        return new EmploymentContractPage(contracts.Select(Map).ToArray());
    }

    public async Task<EmploymentContractDto> HandleAsync(
        SaveEmploymentContractCommand command,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        await RequireOrganizationManageAsync(identity, cancellationToken);

        return await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                Employee employee = await repository.FindEmployeeByExternalIdAsync(
                        identity.TenantId,
                        Required(command.Contract.EmployeeId, "employeeId"),
                        transactionCancellationToken)
                    ?? throw new FlowProNotFoundException(
                        "employee.not_found",
                        "Employee was not found.");
                int weeklyMinutes = ToWeeklyMinutes(command.Contract.WeeklyHours);
                EmploymentContract? contract = command.Contract.Id is Guid contractId
                    ? await repository.FindContractAsync(
                        identity.TenantId,
                        contractId,
                        transactionCancellationToken)
                    : null;

                if (contract is null)
                {
                    contract = new EmploymentContract(
                        identity.TenantId,
                        employee.Id,
                        command.Contract.EffectiveFrom,
                        weeklyMinutes,
                        Required(command.Contract.TimeZoneId, "timeZoneId"));
                    contract.Update(
                        command.Contract.EffectiveFrom,
                        command.Contract.EffectiveTo,
                        weeklyMinutes,
                        command.Contract.TimeZoneId);
                    repository.AddContract(contract);
                }
                else
                {
                    if (contract.EmployeeId != employee.Id)
                    {
                        throw new FlowProValidationException(
                            "employment_contract.employee_mismatch",
                            "Contract does not belong to the supplied employee.");
                    }

                    contract.Update(
                        command.Contract.EffectiveFrom,
                        command.Contract.EffectiveTo,
                        weeklyMinutes,
                        command.Contract.TimeZoneId);
                }

                EmploymentContractDto saved = Map(contract, employee, command.Contract.EmployeeId);
                AddAuditAndOutbox(identity, contract.Id, "employment_contract.saved.v1", saved);
                return saved;
            },
            cancellationToken);
    }

    private async Task RequireOrganizationManageAsync(
        RequestIdentity identity,
        CancellationToken cancellationToken)
    {
        bool allowed = await permissionChecker.HasPermissionAsync(
            identity.TenantId,
            identity.UserId,
            PermissionKeys.OrganizationManage,
            cancellationToken);

        if (!allowed)
        {
            throw new FlowProForbiddenException(
                "organization.manage_required",
                "Managing employment contracts requires the organization.manage permission.");
        }
    }

    private void AddAuditAndOutbox(RequestIdentity identity, Guid contractId, string eventType, object payload)
    {
        DateTimeOffset now = timeProvider.GetUtcNow();
        string payloadJson = JsonSerializer.Serialize(payload, JsonOptions);

        outboxWriter.Add(
            new OutboxMessage(
                identity.TenantId,
                eventType,
                "employment-contract",
                contractId,
                payloadJson,
                now));
        auditWriter.Add(
            new AuditEvent(
                identity.TenantId,
                identity.UserId,
                eventType,
                "employment-contract",
                contractId,
                payloadJson,
                now));
    }

    private static EmploymentContractDto Map(EmploymentContractProjection projection) =>
        Map(projection.Contract, projection.Employee, projection.User.ExternalSubject);

    private static EmploymentContractDto Map(EmploymentContract contract, Employee employee, string employeeExternalId) =>
        new(
            contract.Id,
            employeeExternalId,
            contract.EffectiveFrom,
            contract.EffectiveTo,
            contract.WeeklyMinutes / 60d,
            contract.TimeZoneId,
            contract.CreatedAt,
            contract.UpdatedAt);

    private static int ToWeeklyMinutes(double weeklyHours)
    {
        int weeklyMinutes = (int)Math.Round(weeklyHours * 60);
        if (weeklyMinutes is <= 0 or > 10_080)
        {
            throw new FlowProValidationException(
                "employment_contract.invalid_weekly_hours",
                "Weekly hours must be greater than zero and no more than 168.");
        }

        return weeklyMinutes;
    }

    private static string Required(string? value, string name)
    {
        string normalized = value?.Trim() ?? string.Empty;
        if (normalized.Length == 0)
        {
            throw new FlowProValidationException(
                "employment_contract.required",
                $"{name} is required.");
        }

        return normalized;
    }
}
