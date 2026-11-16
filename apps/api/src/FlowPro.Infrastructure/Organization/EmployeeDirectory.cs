using FlowPro.Application.Organization;
using FlowPro.Domain.Organization;
using FlowPro.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Infrastructure.Organization;

internal sealed class EmployeeDirectory(FlowProDbContext dbContext) : IEmployeeDirectory
{
    public Task<Employee?> FindActiveByUserIdAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken) =>
        dbContext.Employees
            .AsNoTracking()
            .SingleOrDefaultAsync(
                employee => employee.TenantId == tenantId
                    && employee.UserId == userId
                    && employee.IsActive,
                cancellationToken);
}
