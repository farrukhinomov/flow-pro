using FlowPro.Application.Common;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Organization;

namespace FlowPro.Application.Organization;

public sealed record ListEmploymentContractsQuery(string? EmployeeId = null) : IQuery<EmploymentContractPage>;

public sealed record SaveEmploymentContractCommand(EmploymentContractDto Contract) : ICommand<EmploymentContractDto>;

public sealed record EmploymentContractDto(
    Guid? Id,
    string EmployeeId,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    double WeeklyHours,
    string TimeZoneId,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record EmploymentContractPage(IReadOnlyList<EmploymentContractDto> Items);

public interface IEmploymentContractWorkflowRepository
{
    Task<IReadOnlyList<EmploymentContractProjection>> ListAsync(
        Guid tenantId,
        string? employeeExternalId,
        CancellationToken cancellationToken);

    Task<EmploymentContract?> FindContractAsync(
        Guid tenantId,
        Guid contractId,
        CancellationToken cancellationToken);

    Task<Employee?> FindEmployeeByExternalIdAsync(
        Guid tenantId,
        string employeeExternalId,
        CancellationToken cancellationToken);

    void AddContract(EmploymentContract contract);
}

public sealed record EmploymentContractProjection(
    EmploymentContract Contract,
    Employee Employee,
    Membership User);
