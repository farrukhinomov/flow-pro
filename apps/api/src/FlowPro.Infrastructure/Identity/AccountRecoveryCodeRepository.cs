using FlowPro.Application.Accounts;
using FlowPro.Domain.Identity;
using FlowPro.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Infrastructure.Identity;

internal sealed class AccountRecoveryCodeRepository(FlowProDbContext dbContext) : IAccountRecoveryCodeRepository
{
    public void Add(AccountRecoveryCode code) => dbContext.AccountRecoveryCodes.Add(code);

    // Tracked: using a code marks it used.
    public async Task<IReadOnlyList<AccountRecoveryCode>> ListUnusedAsync(
        Guid accountId,
        CancellationToken cancellationToken) =>
        await dbContext.AccountRecoveryCodes
            .Where(code => code.AccountId == accountId && code.UsedAt == null)
            .ToListAsync(cancellationToken);

    public Task RemoveAllAsync(Guid accountId, CancellationToken cancellationToken) =>
        dbContext.AccountRecoveryCodes
            .Where(code => code.AccountId == accountId)
            .ExecuteDeleteAsync(cancellationToken);
}
