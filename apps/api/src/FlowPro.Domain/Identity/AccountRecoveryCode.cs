using FlowPro.Domain.Common;

namespace FlowPro.Domain.Identity;

/// <summary>
/// A single-use code that replaces the authenticator app for one sign-in, for when the phone is
/// lost. Only the SHA-256 hash of the code is stored.
/// </summary>
public sealed class AccountRecoveryCode
{
    private AccountRecoveryCode()
    {
    }

    public AccountRecoveryCode(Guid accountId, string codeHash, DateTimeOffset now)
    {
        Id = Guid.CreateVersion7();
        AccountId = accountId;
        CodeHash = Guard.Required(codeHash, nameof(codeHash), 64);
        CreatedAt = now;
    }

    public Guid Id { get; private set; }

    public Guid AccountId { get; private set; }

    public string CodeHash { get; private set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UsedAt { get; private set; }

    public bool IsUsed => UsedAt is not null;

    public void Use(DateTimeOffset now)
    {
        if (UsedAt is not null)
        {
            throw new InvalidOperationException("The recovery code was already used.");
        }

        UsedAt = now;
    }
}
