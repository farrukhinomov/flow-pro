using FlowPro.Domain.Identity;

namespace FlowPro.Domain.Tests.Identity;

public sealed class AccountSessionTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 13, 9, 0, 0, TimeSpan.Zero);
    private static readonly TimeSpan Lifetime = TimeSpan.FromDays(30);
    private static readonly TimeSpan IdleTimeout = TimeSpan.FromDays(7);
    private static readonly string TokenHash = new('a', 64);

    [Fact]
    public void A_new_session_is_active_and_expires_after_its_lifetime()
    {
        AccountSession session = NewSession();

        Assert.True(session.IsActive(Now, IdleTimeout));
        Assert.Equal(Now + Lifetime, session.ExpiresAt);
    }

    [Fact]
    public void A_session_ends_when_idle_for_too_long()
    {
        AccountSession session = NewSession();

        Assert.True(session.IsActive(Now + IdleTimeout - TimeSpan.FromSeconds(1), IdleTimeout));
        Assert.False(session.IsActive(Now + IdleTimeout, IdleTimeout));
    }

    [Fact]
    public void A_session_ends_at_its_absolute_expiry_even_when_active()
    {
        AccountSession session = NewSession();
        DateTimeOffset justBeforeExpiry = session.ExpiresAt - TimeSpan.FromMinutes(1);
        session.Touch(justBeforeExpiry, TimeSpan.Zero);

        Assert.True(session.IsActive(justBeforeExpiry, IdleTimeout));
        Assert.False(session.IsActive(session.ExpiresAt, IdleTimeout));
    }

    [Fact]
    public void A_revoked_session_is_not_active_and_keeps_its_first_revocation_time()
    {
        AccountSession session = NewSession();

        session.Revoke(Now.AddMinutes(1));
        session.Revoke(Now.AddMinutes(5));

        Assert.False(session.IsActive(Now.AddMinutes(2), IdleTimeout));
        Assert.Equal(Now.AddMinutes(1), session.RevokedAt);
    }

    [Fact]
    public void Activity_is_recorded_at_most_once_per_interval()
    {
        AccountSession session = NewSession();
        TimeSpan interval = TimeSpan.FromMinutes(5);

        Assert.False(session.Touch(Now.AddMinutes(4), interval));
        Assert.Equal(Now, session.LastSeenAt);
        Assert.True(session.Touch(Now.AddMinutes(5), interval));
        Assert.Equal(Now.AddMinutes(5), session.LastSeenAt);
    }

    [Fact]
    public void Client_details_are_trimmed_to_the_stored_length()
    {
        AccountSession session = new(
            Guid.CreateVersion7(),
            TokenHash,
            Now,
            Lifetime,
            new string('u', 900),
            "  203.0.113.7  ");

        Assert.Equal(400, session.UserAgent!.Length);
        Assert.Equal("203.0.113.7", session.IpAddress);
    }

    [Fact]
    public void A_non_positive_lifetime_is_rejected()
    {
        Assert.Throws<ArgumentOutOfRangeException>(
            () => new AccountSession(Guid.CreateVersion7(), TokenHash, Now, TimeSpan.Zero, null, null));
    }

    private static AccountSession NewSession() =>
        new(Guid.CreateVersion7(), TokenHash, Now, Lifetime, "TestBrowser/1.0", "203.0.113.7");
}
