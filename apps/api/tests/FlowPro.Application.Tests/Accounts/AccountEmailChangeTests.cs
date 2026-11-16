using FlowPro.Application.Accounts;
using FlowPro.Application.Common;
using FlowPro.Domain.Identity;

namespace FlowPro.Application.Tests.Accounts;

public sealed class AccountEmailChangeTests
{
    private const string Email = "ada@example.com";
    private const string NewEmail = "ada@newmail.example";
    private const string Password = "correct horse battery";

    private static readonly DateTimeOffset Now = new(2026, 11, 14, 9, 0, 0, TimeSpan.Zero);
    private static readonly ClientContext Client = new("203.0.113.7", "TestBrowser/1.0");

    [Fact]
    public async Task Asking_sends_a_link_to_the_new_address_and_keeps_the_old_one_for_now()
    {
        Fixture fixture = new();

        await fixture.RequestAsync(" Ada@NewMail.example ");

        EmailMessage message = Assert.Single(fixture.Mail.Sent);
        Assert.Equal(NewEmail, message.To);
        Assert.Contains(
            "https://flowpro.test/confirm-email-change#token=",
            message.TextBody,
            StringComparison.Ordinal);
        AccountToken token = Assert.Single(fixture.Store.Tokens);
        Assert.Equal(AccountTokenPurposes.EmailChange, token.Purpose);
        Assert.Equal(NewEmail, token.NewEmail);
        Assert.Equal(Email, fixture.Account.Email);
        Assert.Contains(fixture.Store.Events, item => item.Type == AccountSecurityEventTypes.EmailChangeRequested);
    }

    [Fact]
    public async Task A_wrong_current_password_sends_nothing_and_is_recorded()
    {
        Fixture fixture = new();

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.RequestAsync(NewEmail, password: "not the password"));

        Assert.Equal(AccountSecurityHandler.CurrentPasswordIncorrectCode, exception.Code);
        Assert.Empty(fixture.Mail.Sent);
        Assert.Empty(fixture.Store.Tokens);
        Assert.Contains(fixture.Store.Events, item => item.Type == AccountSecurityEventTypes.SignInFailed);
    }

    [Fact]
    public async Task An_address_of_another_account_gets_a_notice_instead_of_a_link()
    {
        Fixture fixture = new();
        fixture.Credentials.Seed(NewEmail, "someone else's passphrase");

        // The request succeeds like any other, so it does not reveal that the address is taken.
        await fixture.RequestAsync(NewEmail);

        EmailMessage notice = Assert.Single(fixture.Mail.Sent);
        Assert.Equal(NewEmail, notice.To);
        Assert.DoesNotContain("token", notice.TextBody, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(fixture.Store.Tokens);
    }

    [Fact]
    public async Task The_current_address_is_not_a_change()
    {
        Fixture fixture = new();

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.RequestAsync("ADA@example.com"));

        Assert.Equal(AccountSecurityHandler.EmailUnchangedCode, exception.Code);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-address")]
    [InlineData("Ada <ada@newmail.example>")]
    public async Task Something_that_is_not_an_address_is_rejected(string newEmail)
    {
        Fixture fixture = new();

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.RequestAsync(newEmail));

        Assert.Equal(AccountSecurityHandler.EmailInvalidCode, exception.Code);
        Assert.Empty(fixture.Mail.Sent);
    }

    [Fact]
    public async Task Confirming_moves_the_account_and_its_memberships_and_tells_the_old_address()
    {
        Fixture fixture = new();
        string stampBefore = fixture.Account.SecurityStamp;
        await fixture.RequestAsync(NewEmail);
        string link = fixture.Mail.LastToken();

        EmailChangeCompleted result = await fixture.ConfirmAsync(link);

        Assert.Equal(NewEmail, result.Email);
        Assert.Equal(NewEmail, fixture.Account.Email);
        Assert.True(fixture.Account.EmailConfirmed);
        Assert.NotEqual(stampBefore, fixture.Account.SecurityStamp);
        Assert.Equal((fixture.Account.Id, Email, NewEmail), Assert.Single(fixture.Store.MembershipMoves));
        EmailMessage notice = fixture.Mail.Sent[^1];
        Assert.Equal(Email, notice.To);
        Assert.Contains(NewEmail, notice.TextBody, StringComparison.Ordinal);
        Assert.Contains(fixture.Store.Events, item => item.Type == AccountSecurityEventTypes.EmailChanged);

        // The account now signs in with the new address only.
        Assert.Equal(Password, fixture.Credentials.PasswordOf(NewEmail));
        Assert.Null(fixture.Credentials.PasswordOf(Email));
    }

    [Fact]
    public async Task Confirming_ends_links_that_were_sent_to_the_old_address()
    {
        Fixture fixture = new();
        fixture.Store.Add(new AccountToken(
            fixture.Account.Id,
            AccountTokenPurposes.PasswordReset,
            new string('c', 64),
            Now,
            TimeSpan.FromHours(1)));
        await fixture.RequestAsync(NewEmail);

        await fixture.ConfirmAsync(fixture.Mail.LastToken());

        Assert.All(fixture.Store.Tokens, token => Assert.NotNull(token.ConsumedAt));
    }

    [Fact]
    public async Task A_link_works_once()
    {
        Fixture fixture = new();
        await fixture.RequestAsync(NewEmail);
        string token = fixture.Mail.LastToken();
        await fixture.ConfirmAsync(token);

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.ConfirmAsync(token));

        Assert.Equal(AccountRecoveryHandler.InvalidTokenCode, exception.Code);
    }

    [Fact]
    public async Task Only_the_newest_link_works()
    {
        Fixture fixture = new();
        await fixture.RequestAsync(NewEmail);
        string first = fixture.Mail.LastToken();
        await fixture.RequestAsync("ada@third.example");

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.ConfirmAsync(first));

        Assert.Equal(AccountRecoveryHandler.InvalidTokenCode, exception.Code);
        Assert.Equal(Email, fixture.Account.Email);
    }

    [Fact]
    public async Task An_address_taken_after_the_link_was_sent_is_refused()
    {
        Fixture fixture = new();
        await fixture.RequestAsync(NewEmail);
        string token = fixture.Mail.LastToken();
        fixture.Credentials.Seed(NewEmail, "someone else's passphrase");

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.ConfirmAsync(token));

        Assert.Equal(AccountRecoveryHandler.EmailTakenCode, exception.Code);
        Assert.Equal(Email, fixture.Account.Email);
        Assert.Empty(fixture.Store.MembershipMoves);
    }

    private sealed class Fixture
    {
        public Fixture()
        {
            Account = Credentials.Seed(Email, Password);
            Store = new FakeSessionStore(Credentials);
            AccountMailbox mailbox = new(
                Store,
                Mail,
                new AccountEmailOptions { AppBaseUrl = new Uri("https://flowpro.test") },
                Time);
            UnitOfWork = new PassThroughUnitOfWork();
            Security = new AccountSecurityHandler(
                Credentials,
                Store,
                Store,
                new FakeRecoveryCodes(),
                new CurrentPasswordCheck(Credentials, Store, Time),
                TestSharedAccounts.None,
                mailbox,
                UnitOfWork,
                new AccountSessionOptions(),
                Time);
            Recovery = new AccountRecoveryHandler(
                Credentials,
                Store,
                Store,
                Store,
                Store,
                mailbox,
                UnitOfWork,
                Time);
            Session = new AccountSession(
                Account.Id,
                new string('a', 64),
                Now,
                TimeSpan.FromDays(30),
                "TestBrowser/1.0",
                "203.0.113.7");
            Store.Add(Session);
        }

        public MutableTimeProvider Time { get; } = new(Now);

        public FakeCredentials Credentials { get; } = new();

        public FakeSessionStore Store { get; }

        public FakeEmailQueue Mail { get; } = new();

        public PassThroughUnitOfWork UnitOfWork { get; }

        public Account Account { get; }

        public AccountSession Session { get; }

        public AccountSecurityHandler Security { get; }

        public AccountRecoveryHandler Recovery { get; }

        public Task<EmailRequestAccepted> RequestAsync(string newEmail, string password = Password) =>
            Security.HandleAsync(
                new ChangeEmailCommand(new AccountCaller(Account.Id, Session.Id), password, newEmail, Client),
                CancellationToken.None);

        public Task<EmailChangeCompleted> ConfirmAsync(string token) =>
            Recovery.HandleAsync(new ConfirmEmailChangeCommand(token, Client), CancellationToken.None);
    }
}
