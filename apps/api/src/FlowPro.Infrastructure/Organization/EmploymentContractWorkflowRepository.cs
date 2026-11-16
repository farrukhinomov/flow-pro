using FlowPro.Application.Organization;
using FlowPro.Domain.Organization;
using FlowPro.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Infrastructure.Organization;

internal sealed class EmploymentContractWorkflowRepository(FlowProDbContext dbContext)
    : IEmploymentContractWorkflowRepository
{
    public async Task<IReadOnlyList<EmploymentContractProjection>> ListAsync(
        Guid tenantId,
        string? employeeExternalId,
        CancellationToken cancellationToken)
    {
        var query =
            from contract in dbContext.EmploymentContracts.AsNoTracking()
            join employee in dbContext.Employees.AsNoTracking()
                on new { contract.TenantId, Id = contract.EmployeeId }
                equals new { employee.TenantId, employee.Id }
            join user in dbContext.Users.AsNoTracking()
                on new { employee.TenantId, Id = employee.UserId }
                equals new { user.TenantId, user.Id }
            where contract.TenantId == tenantId
            select new EmploymentContractProjection(contract, employee, user);

        if (!string.IsNullOrWhiteSpace(employeeExternalId))
        {
            string normalizedExternalId = employeeExternalId.Trim();
            query = query.Where(projection => projection.User.ExternalSubject == normalizedExternalId);
        }

        return await query
            .OrderBy(projection => projection.User.ExternalSubject)
            .ThenByDescending(projection => projection.Contract.EffectiveFrom)
            .ToArrayAsync(cancellationToken);
    }

    public Task<EmploymentContract?> FindContractAsync(
        Guid tenantId,
        Guid contractId,
        CancellationToken cancellationToken) =>
        dbContext.EmploymentContracts.SingleOrDefaultAsync(
            contract => contract.TenantId == tenantId && contract.Id == contractId,
            cancellationToken);

    public async Task<Employee?> FindEmployeeByExternalIdAsync(
        Guid tenantId,
        string employeeExternalId,
        CancellationToken cancellationToken)
    {
        string normalizedExternalId = employeeExternalId.Trim();
        return await (
            from employee in dbContext.Employees
            join user in dbContext.Users
                on new { employee.TenantId, Id = employee.UserId }
                equals new { user.TenantId, user.Id }
            where employee.TenantId == tenantId
                && user.ExternalSubject == normalizedExternalId
            select employee)
            .SingleOrDefaultAsync(cancellationToken);
    }

    public void AddContract(EmploymentContract contract) =>
        dbContext.EmploymentContracts.Add(contract);
}
