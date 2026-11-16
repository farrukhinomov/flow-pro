using FlowPro.Domain.Common;

namespace FlowPro.Domain.Identity;

/// <summary>
/// A single-use link that lets the person behind an email address take up a membership an
/// administrator prepared for them.
/// </summary>
/// <remarks>
/// Like account tokens, only the SHA-256 hash of the secret is stored. Sending a newer invitation
/// for the same membership revokes the older ones, so only the newest link works.
/// </remarks>
public sealed class MembershipInvitation
{
    private MembershipInvitation()
    {
    }

    public MembershipInvitation(
        Guid tenantId,
        Guid userId,
        string email,
        string tokenHash,
        DateTimeOffset now,
        TimeSpan lifetime)
    {
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(lifetime, TimeSpan.Zero);

        if (tenantId == Guid.Empty || userId == Guid.Empty)
        {
            throw new ArgumentException("An invitation belongs to a membership.");
        }

        Id = Guid.CreateVersion7();
        TenantId = tenantId;
        UserId = userId;
        Email = Account.NormalizeEmail(email);
        TokenHash = Guard.Required(tokenHash, nameof(tokenHash), 64);
        CreatedAt = now;
        ExpiresAt = now + lifetime;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    /// <summary>The membership the invitation is for.</summary>
    public Guid UserId { get; private set; }

    /// <summary>The address the link was sent to. Only the account with this address may accept.</summary>
    public string Email { get; private set; } = string.Empty;

    public string TokenHash { get; private set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset ExpiresAt { get; private set; }

    public DateTimeOffset? AcceptedAt { get; private set; }

    /// <summary>When a newer invitation replaced this one, or the membership was closed.</summary>
    public DateTimeOffset? RevokedAt { get; private set; }

    public bool IsUsable(DateTimeOffset now) =>
        AcceptedAt is null && RevokedAt is null && now < ExpiresAt;

    public void Accept(DateTimeOffset now)
    {
        if (!IsUsable(now))
        {
            throw new InvalidOperationException("This invitation can no longer be accepted.");
        }

        AcceptedAt = now;
    }

    public void Revoke(DateTimeOffset now)
    {
        if (AcceptedAt is null)
        {
            RevokedAt ??= now;
        }
    }
}
