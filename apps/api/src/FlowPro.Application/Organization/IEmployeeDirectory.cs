using FlowPro.Domain.Organization;

namespace FlowPro.Application.Organization;

public interface IEmployeeDirectory
{
    Task<Employee?> FindActiveByUserIdAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken);
}
