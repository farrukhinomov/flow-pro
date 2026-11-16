using FlowPro.Application.Accounts;
using FlowPro.Application.Common;
using FlowPro.Domain.Identity;

namespace FlowPro.Application.Tests.Accounts;

public sealed class AccountWorkspaceTests
{
    private const string Email = "ada@example.com";
    private const string Password = "correct horse battery";

    private static readonly DateTimeOffset Now = new(2026, 11, 14, 9, 0, 0, TimeSpan.Zero);
    private static readonly ClientContext Client = new("203.0.113.7", "TestBrowser/1.0");

    private static readonly AccountWorkspace Older = new(Guid.CreateVersion7(), "Zeta Works", Now.AddDays(-30));
    private static readonly AccountWorkspace Newer = new(Guid.CreateVersion7(), "Acme", Now.AddDays(-2));

    [Fact]
    public void A_new_session_starts_in_the_workspace_chosen_last()
    {
        Assert.Equal(Newer.TenantId, WorkspaceSelection.ChooseDefault([Older, Newer], Newer.TenantId));
    }

    [Fact]
    public void Without_a_usable_last_choice_a_new_session_starts_in_the_oldest_membership()
    {
        Assert.Equal(Older.TenantId, WorkspaceSelection.ChooseDefault([Newer, Older], lastChosen: null));
        Assert.Equal(Older.TenantId, WorkspaceSelection.ChooseDefault([Newer, Older], Guid.CreateVersion7()));
        Assert.Null(WorkspaceSelection.ChooseDefault([], lastChosen: null));
    }

    [Fact]
    public void The_current_workspace_follows_the_same_rule_as_the_api()
    {
        Assert.Equal(Newer.TenantId, WorkspaceSelection.Current([Older, Newer], Newer.TenantId));

        // A workspace the account left falls back to its only remaining one.
        Assert.Equal(Older.TenantId, WorkspaceSelection.Current([Older], Newer.TenantId));

        // Several and none chosen: no guess.
        Assert.Null(WorkspaceSelection.Current([Older, Newer], chosen: null));
    }

    [Fact]
    public async Task The_list_marks_the_workspace_this_session_acts_in()
    {
        Fixture fixture = new();
        fixture.Session.SelectTenant(Older.TenantId);

        WorkspaceList list = await fixture.Workspaces.HandleAsync(
            new ListWorkspacesQuery(fixture.Caller),
            CancellationToken.None);

        Assert.Equal(["Acme", "Zeta Works"], list.Workspaces.Select(workspace => workspace.Name));
        Assert.True(list.Workspaces.Single(workspace => workspace.TenantId == Older.TenantId).IsCurrent);
        Assert.False(list.Workspaces.Single(workspace => workspace.TenantId == Newer.TenantId).IsCurrent);
    }

    [Fact]
    public async Task Switching_moves_only_this_session()
    {
        Fixture fixture = new();
        fixture.Session.SelectTenant(Older.TenantId);
        AccountSession otherDevice = fixture.AddSession();
        otherDevice.SelectTenant(Older.TenantId);

        await fixture.Workspaces.HandleAsync(
            new SwitchWorkspaceCommand(fixture.Caller, Newer.TenantId),
            CancellationToken.None);

        Assert.Equal(Newer.TenantId, fixture.Session.ActiveTenantId);
        Assert.Equal(Older.TenantId, otherDevice.ActiveTenantId);
    }

    [Fact]
    public async Task A_workspace_the_account_does_not_belong_to_looks_like_it_does_not_exist()
    {
        Fixture fixture = new();
        fixture.Session.SelectTenant(Older.TenantId);

        FlowProNotFoundException exception = await Assert.ThrowsAsync<FlowProNotFoundException>(
            () => fixture.Workspaces.HandleAsync(
                new SwitchWorkspaceCommand(fixture.Caller, Guid.CreateVersion7()),
                CancellationToken.None));

        Assert.Equal(AccountWorkspaceHandler.WorkspaceNotFoundCode, exception.Code);
        Assert.Equal(Older.TenantId, fixture.Session.ActiveTenantId);
    }

    [Fact]
    public async Task A_session_of_another_account_cannot_be_switched()
    {
        Fixture fixture = new();

        await Assert.ThrowsAsync<FlowProUnauthorizedException>(
            () => fixture.Workspaces.HandleAsync(
                new SwitchWorkspaceCommand(
                    new AccountCaller(Guid.CreateVersion7(), fixture.Session.Id),
                    Newer.TenantId),
                CancellationToken.None));
    }

    [Fact]
    public async Task Signing_in_starts_in_the_workspace_used_last()
    {
        Fixture fixture = new();
        fixture.Session.SelectTenant(Newer.TenantId);

        IssuedSession issued = await fixture.SignInAsync();

        Assert.Equal(Newer.TenantId, fixture.SessionFor(issued).ActiveTenantId);
    }

    [Fact]
    public async Task Signing_in_for_the_first_time_starts_in_the_oldest_membership()
    {
        Fixture fixture = new();

        IssuedSession issued = await fixture.SignInAsync();

        Assert.Equal(Older.TenantId, fixture.SessionFor(issued).ActiveTenantId);
    }

    private sealed class Fixture
    {
        private int sessionCount;

        public Fixture()
        {
            Account = Credentials.Seed(Email, Password);
            Store = new FakeSessionStore(Credentials);
            Store.Workspaces[Account.Id] = [Older, Newer];
            Workspaces = new AccountWorkspaceHandler(Store, Store, new PassThroughUnitOfWork());
            Sessions = new AccountSessionHandler(
                Credentials,
                Store,
                Store,
                Store,
                new AccountSessionIssuer(Store, Store, new AccountSessionOptions(), Time),
                new AccountMailbox(Store, new FakeEmailQueue(), new AccountEmailOptions(), Time),
                new PassThroughUnitOfWork(),
                new AccountSessionOptions(),
                Time);
            Session = AddSession();
        }

        public MutableTimeProvider Time { get; } = new(Now);

        public FakeCredentials Credentials { get; } = new();

        public FakeSessionStore Store { get; }

        public Account Account { get; }

        public AccountSession Session { get; }

        public AccountCaller Caller => new(Account.Id, Session.Id);

        public AccountWorkspaceHandler Workspaces { get; }

        public AccountSessionHandler Sessions { get; }

        public AccountSession AddSession()
        {
            sessionCount++;
            AccountSession session = new(
                Account.Id,
                sessionCount.ToString("x64", System.Globalization.CultureInfo.InvariantCulture),
                Time.GetUtcNow(),
                TimeSpan.FromDays(30),
                "TestBrowser/1.0",
                "203.0.113.7");
            Store.Add(session);
            return session;
        }

        public async Task<IssuedSession> SignInAsync() =>
            (await Sessions.HandleAsync(new SignInCommand(Email, Password, Client), CancellationToken.None)).Session!;

        public AccountSession SessionFor(IssuedSession issued) =>
            Store.Sessions.Single(session => session.TokenHash == SessionToken.Hash(issued.Token));
    }
}
