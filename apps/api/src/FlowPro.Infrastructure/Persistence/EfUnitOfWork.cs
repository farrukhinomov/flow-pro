using System.Data;
using FlowPro.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Infrastructure.Persistence;

internal sealed class EfUnitOfWork(
    FlowProDbContext dbContext,
    ICurrentRequestContext requestContext) : IUnitOfWork
{
    public async Task<TResult> ExecuteAsync<TResult>(
        Func<CancellationToken, Task<TResult>> operation,
        CancellationToken cancellationToken)
    {
        Microsoft.EntityFrameworkCore.Storage.IExecutionStrategy executionStrategy =
            dbContext.Database.CreateExecutionStrategy();

        return await executionStrategy.ExecuteAsync(
            async () =>
            {
                dbContext.ChangeTracker.Clear();
                await using Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction =
                    await dbContext.Database.BeginTransactionAsync(
                        IsolationLevel.ReadCommitted,
                        cancellationToken);

                RequestIdentity? identity = requestContext.TryGetIdentity();
                if (identity is not null)
                {
                    await dbContext.Database.ExecuteSqlInterpolatedAsync(
                        $"SELECT set_config('flowpro.tenant_id', {identity.TenantId.ToString()}, true)",
                        cancellationToken);
                }

                TResult result = await operation(cancellationToken);
                await dbContext.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return result;
            });
    }
}
