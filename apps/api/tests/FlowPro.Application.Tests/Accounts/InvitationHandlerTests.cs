using FlowPro.Application.Accounts;
using FlowPro.Application.Common;
using FlowPro.Domain.Identity;

namespace FlowPro.Application.Tests.Accounts;

public sealed class InvitationHandlerTests
{
    private const string InvitedEmail = "grace@example.com";
    private const string Password = "a long enough passphrase";

    private static readonly Guid TenantId = Guid.CreateVersion7();
    private static readonly DateTimeOffset Now = new(2026, 11, 14, 9, 0, 0, TimeSpan.Zero);
    private static readonly ClientContext Client = new("203.0.113.7", "TestBrowser/1.0");

    [Fact]
    public async Task The_preview_names_the_workspace_and_whether_the_address_has_an_account()
    {
        Fixture fixture = await Fixture.InvitedAsync();

        InvitationPreview before = await fixture.PreviewAsync();
        fixture.Credentials.Seed(InvitedEmail, Password);
        InvitationPreview after = await fixture.PreviewAsync();

        Assert.Equal("Acme", before.WorkspaceName);
        Assert.Equal(InvitedEmail, before.Email);
        Assert.False(before.AccountExists);
        Assert.True(after.AccountExists);
    }

    [Fact]
    public async Task A_new_account_takes_up_the_membership_and_starts_in_that_workspace()
    {
        Fixture fixture = await Fixture.InvitedAsync();

        IssuedSession issued = await fixture.Handler.HandleAsync(
            new AcceptInvitationWithNewAccountCommand(fixture.Token, "Grace Hopper", Password, Client),
            CancellationToken.None);

        Account account = fixture.Credentials.Find(issued.AccountId)!;
        Assert.Equal(InvitedEmail, account.Email);
        Assert.True(account.EmailConfirmed);
        Assert.Equal(account.Id, fixture.Membership.AccountId);
        Assert.Equal(UserStatus.Active, fixture.Membership.Status);
        Assert.Equal("Grace Hopper", fixture.Membership.DisplayName);
        Assert.NotNull(Assert.Single(fixture.Invitations.Invitations).AcceptedAt);
        Assert.Equal(TenantId, fixture.SessionFor(issued).ActiveTenantId);
        Assert.Equal([TenantId], fixture.UnitOfWork.Scopes.Distinct());
        Assert.Contains(fixture.Store.Events, item => item.Type == AccountSecurityEventTypes.InvitationAccepted);
    }

    [Fact]
    public async Task An_address_that_already_has_an_account_must_sign_in_instead()
    {
        Fixture fixture = await Fixture.InvitedAsync();
        fixture.Credentials.Seed(InvitedEmail, Password);

        FlowProConflictException exception = await Assert.ThrowsAsync<FlowProConflictException>(
            () => fixture.Handler.HandleAsync(
                new AcceptInvitationWithNewAccountCommand(fixture.Token, "Grace", Password, Client),
                CancellationToken.None));

        Assert.Equal("account.email_already_registered", exception.Code);
        Assert.Null(fixture.Membership.AccountId);
    }

    [Fact]
    public async Task A_signed_in_account_with_the_invited_address_joins_and_moves_there()
    {
        Fixture fixture = await Fixture.InvitedAsync();
        Account account = fixture.Credentials.Seed(InvitedEmail, Password);
        AccountSession session = fixture.AddSession(account);

        InvitationAccepted accepted = await fixture.Handler.HandleAsync(
            new AcceptInvitationCommand(fixture.Token, new AccountCaller(account.Id, session.Id), Client),
            CancellationToken.None);

        Assert.Equal(TenantId, accepted.TenantId);
        Assert.Equal("Acme", accepted.WorkspaceName);
        Assert.Equal(account.Id, fixture.Membership.AccountId);
        Assert.Equal(UserStatus.Active, fixture.Membership.Status);
        Assert.Equal(TenantId, session.ActiveTenantId);
    }

    [Fact]
    public async Task An_account_with_another_address_cannot_take_the_invitation()
    {
        Fixture fixture = await Fixture.InvitedAsync();
        Account other = fixture.Credentials.Seed("someone.else@example.com", Password);
        AccountSession session = fixture.AddSession(other);

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.Handler.HandleAsync(
                new AcceptInvitationCommand(fixture.Token, new AccountCaller(other.Id, session.Id), Client),
                CancellationToken.None));

        Assert.Equal(InvitationHandler.OtherAddressCode, exception.Code);
        Assert.Null(fixture.Membership.AccountId);
        Assert.Null(Assert.Single(fixture.Invitations.Invitations).AcceptedAt);
    }

    [Fact]
    public async Task An_invitation_works_once()
    {
        Fixture fixture = await Fixture.InvitedAsync();
        await fixture.Handler.HandleAsync(
            new AcceptInvitationWithNewAccountCommand(fixture.Token, "Grace", Password, Client),
            CancellationToken.None);

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.PreviewAsync());

        Assert.Equal(AccountRecoveryHandler.InvalidTokenCode, exception.Code);
    }

    [Fact]
    public async Task Sending_a_new_invitation_ends_the_previous_link()
    {
        Fixture fixture = await Fixture.InvitedAsync();
        string first = fixture.Token;

        await fixture.InviteAsync();

        await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.Handler.HandleAsync(new PreviewInvitationQuery(first), CancellationToken.None));
        Assert.Equal("Acme", (await fixture.PreviewAsync()).WorkspaceName);
    }

    [Fact]
    public async Task A_closed_membership_cannot_be_taken_up()
    {
        Fixture fixture = await Fixture.InvitedAsync();
        fixture.Membership.Deactivate();

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.PreviewAsync());

        Assert.Equal(AccountRecoveryHandler.InvalidTokenCode, exception.Code);
    }

    [Fact]
    public async Task An_expired_invitation_cannot_be_accepted()
    {
        Fixture fixture = await Fixture.InvitedAsync();
        fixture.Time.Advance(TimeSpan.FromDays(8));

        await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.Handler.HandleAsync(
                new AcceptInvitationWithNewAccountCommand(fixture.Token, "Grace", Password, Client),
                CancellationToken.None));
        Assert.Null(fixture.Membership.AccountId);
    }

    [Fact]
    public async Task A_membership_someone_already_signs_in_to_gets_no_invitation()
    {
        Fixture fixture = new();
        fixture.Membership.LinkAccount(Guid.CreateVersion7());

        Assert.Null(await fixture.Mailbox.PrepareAsync(fixture.Membership, "Acme", CancellationToken.None));
        Assert.Empty(fixture.Invitations.Invitations);
    }

    private sealed class Fixture
    {
        private int sessionCount;

        public Fixture()
        {
            Membership = new Membership(TenantId, "usr-grace", InvitedEmail, "Grace (invited)");
            Membership.MarkInvited();
            Invitations.Memberships.Add(Membership);
            Invitations.WorkspaceNames[TenantId] = "Acme";
            Store = new FakeSessionStore(Credentials);
            Mailbox = new InvitationMailbox(
                Invitations,
                Mail,
                new AccountEmailOptions { AppBaseUrl = new Uri("https://flowpro.test/") },
                Time);
            Handler = new InvitationHandler(
                Invitations,
                Invitations,
                Credentials,
                Store,
                Store,
                new AccountSessionIssuer(Store, Store, new AccountSessionOptions(), Time),
                UnitOfWork,
                Time);
        }

        public MutableTimeProvider Time { get; } = new(Now);

        public FakeCredentials Credentials { get; } = new();

        public FakeSessionStore Store { get; }

        public FakeInvitationStore Invitations { get; } = new();

        public FakeEmailQueue Mail { get; } = new();

        public PassThroughProvisioningUnitOfWork UnitOfWork { get; } = new();

        public Membership Membership { get; }

        public InvitationMailbox Mailbox { get; }

        public InvitationHandler Handler { get; }

        public string Token => Mail.LastToken();

        public static async Task<Fixture> InvitedAsync()
        {
            Fixture fixture = new();
            await fixture.InviteAsync();
            return fixture;
        }

        public async Task InviteAsync() =>
            Mailbox.Send(await Mailbox.PrepareAsync(Membership, "Acme", CancellationToken.None));

        public Task<InvitationPreview> PreviewAsync() =>
            Handler.HandleAsync(new PreviewInvitationQuery(Token), CancellationToken.None);

        public AccountSession AddSession(Account account)
        {
            sessionCount++;
            AccountSession session = new(
                account.Id,
                sessionCount.ToString("x64", System.Globalization.CultureInfo.InvariantCulture),
                Time.GetUtcNow(),
                TimeSpan.FromDays(30),
                "TestBrowser/1.0",
                "203.0.113.7");
            Store.Add(session);
            return session;
        }

        public AccountSession SessionFor(IssuedSession issued) =>
            Store.Sessions.Single(session => session.TokenHash == SessionToken.Hash(issued.Token));
    }
}
