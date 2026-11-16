using FlowPro.Domain.Identity;

namespace FlowPro.Domain.Tests.Identity;

public sealed class AccountTokenTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 13, 9, 0, 0, TimeSpan.Zero);

    [Fact]
    public void A_token_is_usable_for_its_purpose_until_it_expires()
    {
        AccountToken token = Create(TimeSpan.FromHours(1));

        Assert.True(token.IsUsableFor(AccountTokenPurposes.PasswordReset, Now));
        Assert.False(token.IsUsableFor(AccountTokenPurposes.EmailVerification, Now));
        Assert.False(token.IsUsableFor(AccountTokenPurposes.PasswordReset, Now.AddHours(1)));
    }

    [Fact]
    public void A_consumed_token_is_not_usable_and_keeps_its_first_consumption_time()
    {
        AccountToken token = Create(TimeSpan.FromHours(1));

        token.Consume(Now);
        token.Consume(Now.AddMinutes(5));

        Assert.False(token.IsUsableFor(AccountTokenPurposes.PasswordReset, Now));
        Assert.Equal(Now, token.ConsumedAt);
    }

    [Fact]
    public void Unknown_purposes_and_non_positive_lifetimes_are_rejected()
    {
        Assert.Throws<ArgumentException>(
            () => new AccountToken(Guid.CreateVersion7(), "sign_in", new string('a', 64), Now, TimeSpan.FromHours(1)));
        Assert.Throws<ArgumentOutOfRangeException>(() => Create(TimeSpan.Zero));
    }

    [Fact]
    public void An_email_change_token_carries_the_normalized_new_address()
    {
        AccountToken token = new(
            Guid.CreateVersion7(),
            AccountTokenPurposes.EmailChange,
            new string('a', 64),
            Now,
            TimeSpan.FromDays(1),
            " Ada@NewMail.example ");

        Assert.Equal("ada@newmail.example", token.NewEmail);
    }

    [Fact]
    public void Only_an_email_change_token_takes_a_new_address()
    {
        Assert.Throws<ArgumentException>(() => new AccountToken(
            Guid.CreateVersion7(),
            AccountTokenPurposes.EmailChange,
            new string('a', 64),
            Now,
            TimeSpan.FromDays(1)));
        Assert.Throws<ArgumentException>(() => new AccountToken(
            Guid.CreateVersion7(),
            AccountTokenPurposes.PasswordReset,
            new string('a', 64),
            Now,
            TimeSpan.FromHours(1),
            "ada@newmail.example"));
    }

    private static AccountToken Create(TimeSpan lifetime) =>
        new(Guid.CreateVersion7(), AccountTokenPurposes.PasswordReset, new string('a', 64), Now, lifetime);
}
