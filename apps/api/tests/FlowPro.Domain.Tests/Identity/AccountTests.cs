using FlowPro.Domain.Identity;

namespace FlowPro.Domain.Tests.Identity;

public sealed class AccountTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 13, 9, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Email_is_trimmed_and_lower_cased()
    {
        Account account = new("  Ada@Example.COM ", "Ada");

        Assert.Equal("ada@example.com", account.Email);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void An_email_is_required(string? email)
    {
        Assert.Throws<ArgumentException>(() => new Account(email!, "Ada"));
    }

    [Fact]
    public void A_new_account_has_a_security_stamp_and_no_password()
    {
        Account first = new("ada@example.com", "Ada");
        Account second = new("grace@example.com", "Grace");

        Assert.Null(first.PasswordHash);
        Assert.False(first.EmailConfirmed);
        Assert.NotEmpty(first.SecurityStamp);
        Assert.NotEqual(first.SecurityStamp, second.SecurityStamp);
    }

    [Fact]
    public void Lockout_holds_until_its_end_and_not_after()
    {
        Account account = new("ada@example.com", "Ada");

        account.SetLockoutEnd(Now.AddMinutes(15));

        Assert.True(account.IsLockedOut(Now));
        Assert.True(account.IsLockedOut(Now.AddMinutes(14)));
        Assert.False(account.IsLockedOut(Now.AddMinutes(15)));
    }

    [Fact]
    public void Failed_attempts_are_counted_and_can_be_reset()
    {
        Account account = new("ada@example.com", "Ada");

        Assert.Equal(1, account.IncrementAccessFailedCount());
        Assert.Equal(2, account.IncrementAccessFailedCount());

        account.ResetAccessFailedCount();

        Assert.Equal(0, account.AccessFailedCount);
    }

    [Fact]
    public void Every_change_advances_the_version()
    {
        Account account = new("ada@example.com", "Ada");
        long initial = account.Version;

        account.SetPasswordHash("hash");
        account.SetEmailConfirmed(true);

        Assert.Equal(initial + 2, account.Version);
    }

    [Fact]
    public void Two_step_sign_in_turns_on_only_after_setup_and_off_completely()
    {
        Account account = new("ada@example.com", "Ada");

        Assert.Throws<InvalidOperationException>(() => account.EnableTwoFactor(100));

        account.BeginAuthenticatorSetup("protected-key");
        Assert.False(account.TwoFactorEnabled);

        account.EnableTwoFactor(100);
        Assert.True(account.TwoFactorEnabled);
        Assert.Throws<InvalidOperationException>(() => account.BeginAuthenticatorSetup("another-key"));

        account.DisableTwoFactor();
        Assert.False(account.TwoFactorEnabled);
        Assert.Null(account.AuthenticatorKey);
        Assert.Null(account.AuthenticatorTimeStep);
    }

    [Fact]
    public void An_authenticator_code_counts_only_for_a_later_time_step()
    {
        Account account = new("ada@example.com", "Ada");
        account.BeginAuthenticatorSetup("protected-key");
        account.EnableTwoFactor(100);

        Assert.False(account.TryUseAuthenticatorTimeStep(100));
        Assert.False(account.TryUseAuthenticatorTimeStep(99));
        Assert.True(account.TryUseAuthenticatorTimeStep(101));
        Assert.False(account.TryUseAuthenticatorTimeStep(101));
    }

    [Fact]
    public void A_recovery_code_is_used_once()
    {
        AccountRecoveryCode code = new(Guid.CreateVersion7(), new string('a', 64), Now);

        code.Use(Now);

        Assert.True(code.IsUsed);
        Assert.Throws<InvalidOperationException>(() => code.Use(Now));
    }
}
