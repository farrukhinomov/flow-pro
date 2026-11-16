using FlowPro.Application.Accounts;
using FlowPro.Application.Common;
using FlowPro.Domain.Identity;

namespace FlowPro.Application.Tests.Accounts;

public sealed class AccountRecoveryHandlerTests
{
    private const string Email = "ada@example.com";
    private const string OldPassword = "correct horse battery";
    private const string NewPassword = "a brand new passphrase";

    private static readonly DateTimeOffset Now = new(2026, 11, 13, 9, 0, 0, TimeSpan.Zero);
    private static readonly ClientContext Client = new("203.0.113.7", "TestBrowser/1.0");

    [Fact]
    public async Task Asking_for_a_reset_sends_a_link_to_a_known_email()
    {
        Fixture fixture = new();
        fixture.Credentials.Seed(Email, OldPassword);

        await fixture.RequestResetAsync(" Ada@Example.com ");

        EmailMessage message = Assert.Single(fixture.Mail.Sent);
        Assert.Equal(Email, message.To);
        Assert.Contains("https://flowpro.test/reset-password#token=", message.TextBody, StringComparison.Ordinal);
        Assert.Equal(AccountTokenPurposes.PasswordReset, Assert.Single(fixture.Store.Tokens).Purpose);
    }

    [Fact]
    public async Task Asking_for_a_reset_for_an_unknown_email_succeeds_without_sending_anything()
    {
        Fixture fixture = new();

        await fixture.RequestResetAsync("nobody@example.com");

        Assert.Empty(fixture.Mail.Sent);
        Assert.Empty(fixture.Store.Tokens);
        AccountSecurityEvent recorded = Assert.Single(fixture.Store.Events);
        Assert.Equal(AccountSecurityEventTypes.PasswordResetRequested, recorded.Type);
        Assert.Null(recorded.AccountId);
    }

    [Fact]
    public async Task Resetting_sets_the_password_ends_every_session_and_confirms_the_email()
    {
        Fixture fixture = new();
        Account account = fixture.Credentials.Seed(Email, OldPassword);
        fixture.Store.Add(new AccountSession(account.Id, new string('a', 64), Now, TimeSpan.FromDays(1), null, null));
        fixture.Store.Add(new AccountSession(account.Id, new string('b', 64), Now, TimeSpan.FromDays(1), null, null));
        await fixture.RequestResetAsync(Email);

        PasswordResetCompleted result = await fixture.ResetAsync(fixture.Mail.LastToken(), NewPassword);

        Assert.Equal(2, result.SessionsEnded);
        Assert.All(fixture.Store.Sessions, session => Assert.NotNull(session.RevokedAt));
        Assert.Equal(NewPassword, fixture.Credentials.PasswordOf(Email));
        Assert.True(account.EmailConfirmed);
        Assert.Contains(fixture.Store.Events, item => item.Type == AccountSecurityEventTypes.PasswordReset);
    }

    [Fact]
    public async Task A_reset_link_works_only_once()
    {
        Fixture fixture = new();
        fixture.Credentials.Seed(Email, OldPassword);
        await fixture.RequestResetAsync(Email);
        string token = fixture.Mail.LastToken();
        await fixture.ResetAsync(token, NewPassword);

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.ResetAsync(token, "yet another passphrase"));

        Assert.Equal(AccountRecoveryHandler.InvalidTokenCode, exception.Code);
        Assert.Equal(NewPassword, fixture.Credentials.PasswordOf(Email));
    }

    [Fact]
    public async Task A_reset_link_expires()
    {
        Fixture fixture = new();
        fixture.Credentials.Seed(Email, OldPassword);
        await fixture.RequestResetAsync(Email);
        fixture.Time.Advance(fixture.Options.PasswordResetLifetime);

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.ResetAsync(fixture.Mail.LastToken(), NewPassword));

        Assert.Equal(AccountRecoveryHandler.InvalidTokenCode, exception.Code);
    }

    [Fact]
    public async Task A_newer_reset_link_replaces_the_older_one()
    {
        Fixture fixture = new();
        fixture.Credentials.Seed(Email, OldPassword);
        await fixture.RequestResetAsync(Email);
        string first = fixture.Mail.LastToken();
        await fixture.RequestResetAsync(Email);

        await Assert.ThrowsAsync<FlowProValidationException>(() => fixture.ResetAsync(first, NewPassword));
        await fixture.ResetAsync(fixture.Mail.LastToken(), NewPassword);

        Assert.Equal(NewPassword, fixture.Credentials.PasswordOf(Email));
    }

    [Fact]
    public async Task A_rejected_password_keeps_the_link_usable()
    {
        Fixture fixture = new();
        fixture.Credentials.Seed(Email, OldPassword);
        await fixture.RequestResetAsync(Email);
        string token = fixture.Mail.LastToken();

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.ResetAsync(token, "short"));
        await fixture.ResetAsync(token, NewPassword);

        Assert.Equal("account.password_rejected", exception.Code);
        Assert.Equal(NewPassword, fixture.Credentials.PasswordOf(Email));
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-a-token")]
    public async Task A_malformed_reset_token_is_refused(string token)
    {
        Fixture fixture = new();

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.ResetAsync(token, NewPassword));

        Assert.Equal(AccountRecoveryHandler.InvalidTokenCode, exception.Code);
    }

    [Fact]
    public async Task A_confirmation_link_cannot_reset_a_password()
    {
        Fixture fixture = new();
        Account account = fixture.Credentials.Seed(Email, OldPassword);
        await fixture.Handler.HandleAsync(
            new ResendEmailVerificationCommand(account.Id, Client),
            CancellationToken.None);

        await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.ResetAsync(fixture.Mail.LastToken(), NewPassword));

        Assert.Equal(OldPassword, fixture.Credentials.PasswordOf(Email));
    }

    [Fact]
    public async Task Following_the_confirmation_link_confirms_the_email()
    {
        Fixture fixture = new();
        Account account = fixture.Credentials.Seed(Email, OldPassword);
        await fixture.Handler.HandleAsync(
            new ResendEmailVerificationCommand(account.Id, Client),
            CancellationToken.None);

        EmailVerificationCompleted result = await fixture.Handler.HandleAsync(
            new VerifyEmailCommand(fixture.Mail.LastToken(), Client),
            CancellationToken.None);

        Assert.Equal(Email, result.Email);
        Assert.True(account.EmailConfirmed);
        Assert.Contains(fixture.Store.Events, item => item.Type == AccountSecurityEventTypes.EmailVerified);
    }

    [Fact]
    public async Task A_confirmed_account_is_not_sent_another_confirmation()
    {
        Fixture fixture = new();
        Account account = fixture.Credentials.Seed(Email, OldPassword);
        account.SetEmailConfirmed(true);

        await fixture.Handler.HandleAsync(
            new ResendEmailVerificationCommand(account.Id, Client),
            CancellationToken.None);

        Assert.Empty(fixture.Mail.Sent);
    }

    [Fact]
    public async Task Without_an_app_address_no_mail_is_sent()
    {
        Fixture fixture = new(new AccountEmailOptions { AppBaseUrl = null });
        fixture.Credentials.Seed(Email, OldPassword);

        await fixture.RequestResetAsync(Email);

        Assert.Empty(fixture.Mail.Sent);
        Assert.Empty(fixture.Store.Tokens);
    }

    private sealed class Fixture
    {
        public Fixture(AccountEmailOptions? options = null)
        {
            Options = options ?? new AccountEmailOptions { AppBaseUrl = new Uri("https://flowpro.test") };
            Store = new FakeSessionStore(Credentials);
            Handler = new AccountRecoveryHandler(
                Credentials,
                Store,
                Store,
                Store,
                Store,
                new AccountMailbox(Store, Mail, Options, Time),
                new PassThroughUnitOfWork(),
                Time);
        }

        public AccountEmailOptions Options { get; }

        public MutableTimeProvider Time { get; } = new(Now);

        public FakeCredentials Credentials { get; } = new();

        public FakeSessionStore Store { get; }

        public FakeEmailQueue Mail { get; } = new();

        public AccountRecoveryHandler Handler { get; }

        public Task<EmailRequestAccepted> RequestResetAsync(string email) =>
            Handler.HandleAsync(new RequestPasswordResetCommand(email, Client), CancellationToken.None);

        public Task<PasswordResetCompleted> ResetAsync(string token, string password) =>
            Handler.HandleAsync(new ResetPasswordCommand(token, password, Client), CancellationToken.None);
    }
}
