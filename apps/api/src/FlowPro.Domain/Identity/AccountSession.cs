using FlowPro.Domain.Common;

namespace FlowPro.Domain.Identity;

/// <summary>
/// One signed-in browser or device of an <see cref="Account" />.
/// </summary>
/// <remarks>
/// The browser holds a random token; only its hash is stored, so a copy of the database cannot be
/// used to impersonate anyone. A session ends when it is revoked, when it reaches its absolute
/// expiry, or when it has been idle for too long.
/// </remarks>
public sealed class AccountSession
{
    private AccountSession()
    {
    }

    public AccountSession(
        Guid accountId,
        string tokenHash,
        DateTimeOffset now,
        TimeSpan absoluteLifetime,
        string? userAgent,
        string? ipAddress)
    {
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(absoluteLifetime, TimeSpan.Zero);

        Id = Guid.CreateVersion7();
        AccountId = accountId;
        TokenHash = Guard.Required(tokenHash, nameof(tokenHash), 64);
        CreatedAt = now;
        LastSeenAt = now;
        ExpiresAt = now + absoluteLifetime;
        UserAgent = Truncate(userAgent, 400);
        IpAddress = Truncate(ipAddress, 64);
    }

    public Guid Id { get; private set; }

    public Guid AccountId { get; private set; }

    public string TokenHash { get; private set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset LastSeenAt { get; private set; }

    public DateTimeOffset ExpiresAt { get; private set; }

    public DateTimeOffset? RevokedAt { get; private set; }

    public string? UserAgent { get; private set; }

    public string? IpAddress { get; private set; }

    /// <summary>The tenant this session is currently working in, when the account has chosen one.</summary>
    public Guid? ActiveTenantId { get; private set; }

    public bool IsActive(DateTimeOffset now, TimeSpan idleTimeout) =>
        RevokedAt is null
        && now < ExpiresAt
        && now - LastSeenAt < idleTimeout;

    /// <summary>
    /// Records activity. Returns false when the last recorded activity is recent enough that
    /// writing again would only add database load.
    /// </summary>
    public bool Touch(DateTimeOffset now, TimeSpan minimumInterval)
    {
        if (now - LastSeenAt < minimumInterval)
        {
            return false;
        }

        LastSeenAt = now;
        return true;
    }

    public void Revoke(DateTimeOffset now)
    {
        RevokedAt ??= now;
    }

    public void SelectTenant(Guid? tenantId)
    {
        ActiveTenantId = tenantId;
    }

    private static string? Truncate(string? value, int maxLength)
    {
        string? trimmed = value?.Trim();

        if (string.IsNullOrEmpty(trimmed))
        {
            return null;
        }

        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }
}
