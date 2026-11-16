using FlowPro.Application.Accounts;
using FlowPro.Application.Audit;
using FlowPro.Application.Common;
using FlowPro.Application.Demo;
using FlowPro.Application.Identity;
using FlowPro.Application.Integration;
using FlowPro.Application.Tests.Accounts;
using FlowPro.Application.Users;
using FlowPro.Domain.Audit;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Integration;
using FlowPro.Domain.Organization;

namespace FlowPro.Application.Tests.Users;

public sealed class UserWorkflowHandlerTests
{
    private static readonly Guid TenantId = Guid.Parse("01975fa8-7590-7000-8000-000000005001");
    private static readonly Guid ActorUserId = Guid.Parse("01975fa8-7590-7000-8000-000000005002");
    private static readonly DateTimeOffset Now = new(2026, 6, 13, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task ListUsersReturnsAllUsersWhenNoPageIsRequested()
    {
        TestFixture fixture = new();
        fixture.Repository.Projections.Add(CreateProjection("usr-anna-a", "Anna", "Alpha", "employee", "Support"));
        fixture.Repository.Projections.Add(CreateProjection("usr-ben-b", "Ben", "Beta", "manager", "Operations"));

        UserDirectoryPage result = await fixture.Handler.HandleAsync(
            new ListUsersQuery(),
            CancellationToken.None);

        Assert.Null(result.NextCursor);
        Assert.Equal(["usr-anna-a", "usr-ben-b"], result.Items.Select(user => user.Id));
    }

    [Fact]
    public async Task ListedUsersCarryTheirMembershipId()
    {
        TestFixture fixture = new();
        UserDirectoryProjection anna = CreateProjection("usr-anna-a", "Anna", "Alpha", "employee", "Support");
        fixture.Repository.Projections.Add(anna);

        UserDirectoryPage result = await fixture.Handler.HandleAsync(new ListUsersQuery(), CancellationToken.None);

        UserWorkflowRecord listed = Assert.Single(result.Items);
        Assert.Equal("usr-anna-a", listed.Id);
        Assert.Equal(anna.User.Id, listed.UserId);
    }

    [Fact]
    public async Task AnApproverWithoutUsersManageSeesOnlyThemselvesAndTheTeamsTheyLead()
    {
        TestFixture fixture = new();
        fixture.PermissionChecker.DeniedPermissions.Add(PermissionKeys.UsersManage);
        UserDirectoryProjection self = CreateProjection("usr-sam", "Sam", "Rivera", "manager", "Support", ActorUserId);
        UserDirectoryProjection led = CreateProjection("usr-anna-a", "Anna", "Alpha", "employee", "Support");
        UserDirectoryProjection other = CreateProjection("usr-ben-b", "Ben", "Beta", "employee", "Operations");
        led.Team!.Update(null, "SUPPORT", "Support", "team-support", ActorUserId);
        fixture.Repository.Projections.AddRange([self, led, other]);

        UserDirectoryPage result = await fixture.Handler.HandleAsync(new ListUsersQuery(), CancellationToken.None);

        Assert.Equal(["usr-sam", "usr-anna-a"], result.Items.Select(user => user.Id));
    }

    [Fact]
    public async Task WithoutUsersManageOrRequestsApproveTheDirectoryIsForbidden()
    {
        TestFixture fixture = new();
        fixture.PermissionChecker.DeniedPermissions.Add(PermissionKeys.UsersManage);
        fixture.PermissionChecker.DeniedPermissions.Add(PermissionKeys.RequestsApprove);
        fixture.Repository.Projections.Add(CreateProjection("usr-anna-a", "Anna", "Alpha", "employee", "Support"));

        await Assert.ThrowsAsync<FlowProForbiddenException>(
            () => fixture.Handler.HandleAsync(new ListUsersQuery(), CancellationToken.None));
    }

    [Fact]
    public async Task ListUsersSupportsCursorPages()
    {
        TestFixture fixture = new();
        fixture.Repository.Projections.Add(CreateProjection("usr-anna-a", "Anna", "Alpha", "employee", "Support"));
        fixture.Repository.Projections.Add(CreateProjection("usr-ben-b", "Ben", "Beta", "manager", "Operations"));
        fixture.Repository.Projections.Add(CreateProjection("usr-cara-c", "Cara", "Core", "hr", "People"));

        UserDirectoryPage firstPage = await fixture.Handler.HandleAsync(
            new ListUsersQuery(new CursorPageRequest(Limit: 2)),
            CancellationToken.None);
        UserDirectoryPage secondPage = await fixture.Handler.HandleAsync(
            new ListUsersQuery(new CursorPageRequest(firstPage.NextCursor, 2)),
            CancellationToken.None);

        Assert.Equal(["usr-anna-a", "usr-ben-b"], firstPage.Items.Select(user => user.Id));
        Assert.NotNull(firstPage.NextCursor);
        Assert.Equal(["usr-cara-c"], secondPage.Items.Select(user => user.Id));
        Assert.Null(secondPage.NextCursor);
    }

    [Fact]
    public async Task ListUsersSupportsStructuredFilters()
    {
        TestFixture fixture = new();
        fixture.Repository.Projections.Add(CreateProjection("usr-anna-a", "Anna", "Alpha", "employee", "Support"));
        fixture.Repository.Projections.Add(CreateProjection("usr-ben-b", "Ben", "Beta", "manager", "Operations"));
        fixture.Repository.Projections.Add(CreateProjection("usr-cara-c", "Cara", "Core", "employee", "Operations"));

        UserDirectoryPage result = await fixture.Handler.HandleAsync(
            new ListUsersQuery(
                new CursorPageRequest(Limit: 10),
                new UserDirectoryFilter(Search: "operations", Role: "employee")),
            CancellationToken.None);

        Assert.Equal(["usr-cara-c"], result.Items.Select(user => user.Id));
        Assert.Null(result.NextCursor);
    }

    [Fact]
    public async Task UpsertUserWritesNormalizedIdentityAndServerEvents()
    {
        TestFixture fixture = new();

        UserWorkflowResult result = await fixture.Handler.HandleAsync(
            new UpsertUserCommand(
                new UserWorkflowRecord(
                    "usr-lara-schneider",
                    "Lara",
                    "Schneider",
                    "lara.schneider",
                    "lara.schneider@flowpro.test",
                    "",
                    UserStatus.Active,
                    "manager",
                    "role-profile-manager",
                    "Management",
                    "Marta Lindgren",
                    "Full-time",
                    "Team planning details",
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    Now,
                    Now)),
            CancellationToken.None);

        Assert.Equal("usr-lara-schneider", result.User.Id);
        Assert.Equal("manager", result.User.Role);
        Assert.Single(fixture.Repository.Users);
        Assert.Single(fixture.Repository.Employees);
        Assert.Single(fixture.Repository.Teams);
        Assert.Single(fixture.Repository.UserRoles);
        Assert.Equal("user.upserted.v1", Assert.Single(fixture.Outbox.Messages).EventType);
        Assert.Equal("user.upserted.v1", Assert.Single(fixture.Audit.Events).Action);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task A_shared_demo_login_cannot_be_edited_while_the_demo_runs(bool demoEnabled)
    {
        TestFixture fixture = new(demoEnabled ? TestSharedAccounts.Demo : TestSharedAccounts.None);
        DemoLogin login = DemoWorkspace.Logins[^1];
        Membership membership = new(TenantId, "demo-employee", login.Email, login.DisplayName);
        membership.LinkAccount(login.AccountId);
        fixture.Repository.Users.Add(membership);
        fixture.Repository.Employees.Add(new Employee(TenantId, membership.Id, "DEMO-003", login.GivenName, login.FamilyName));
        UpsertUserCommand promote = new(
            new UserWorkflowRecord(
                "demo-employee",
                login.GivenName,
                login.FamilyName,
                "jamie.chen",
                login.Email,
                "",
                UserStatus.Inactive,
                "superadmin",
                "role-profile-superadmin",
                "General",
                "Unassigned",
                "Full-time",
                "Full workspace administration",
                null,
                null,
                null,
                null,
                null,
                null,
                Now,
                Now));

        if (demoEnabled)
        {
            FlowProForbiddenException exception = await Assert.ThrowsAsync<FlowProForbiddenException>(
                () => fixture.Handler.HandleAsync(promote, CancellationToken.None));
            Assert.Equal(SharedAccountPolicy.SharedMembershipCode, exception.Code);
            Assert.Equal(UserStatus.Active, membership.Status);
        }
        else
        {
            await fixture.Handler.HandleAsync(promote, CancellationToken.None);
            Assert.Equal(UserStatus.Inactive, membership.Status);
        }
    }

    [Fact]
    public async Task InvitingSomeoneEmailsThemALinkToTheirMembership()
    {
        TestFixture fixture = new();

        UserWorkflowResult result = await fixture.Handler.HandleAsync(
            new InviteUserCommand("grace.hopper@example.com", "employee", null),
            CancellationToken.None);

        Membership membership = Assert.Single(fixture.Repository.Users);
        Assert.Equal(UserStatus.Invited, membership.Status);
        Assert.Equal(UserStatus.Invited, result.User.Status);
        MembershipInvitation invitation = Assert.Single(fixture.Invitations.Invitations);
        Assert.Equal(membership.Id, invitation.UserId);
        Assert.Equal("grace.hopper@example.com", invitation.Email);
        EmailMessage message = Assert.Single(fixture.Mail.Sent);
        Assert.Equal("grace.hopper@example.com", message.To);
        Assert.Contains("Acme", message.Subject, StringComparison.Ordinal);
        Assert.Contains(
            "https://flowpro.test/accept-invitation#token=",
            message.TextBody,
            StringComparison.Ordinal);
    }

    [Fact]
    public async Task UpsertUserRequiresUsersManagePermission()
    {
        TestFixture fixture = new();
        fixture.PermissionChecker.DeniedPermissions.Add(PermissionKeys.UsersManage);

        await Assert.ThrowsAsync<FlowProForbiddenException>(
            () => fixture.Handler.HandleAsync(
                new UpsertUserCommand(
                    new UserWorkflowRecord(
                        "usr-denied",
                        "Denied",
                        "User",
                        "denied.user",
                        "denied.user@flowpro.test",
                        "",
                        UserStatus.Active,
                        "employee",
                        "role-profile-employee",
                        "Support",
                        "Unassigned",
                        "Full-time",
                        "Availability only",
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        Now,
                        Now)),
                CancellationToken.None));

        Assert.Empty(fixture.Repository.Users);
        Assert.Empty(fixture.Outbox.Messages);
        Assert.Empty(fixture.Audit.Events);
    }

    private sealed class TestFixture
    {
        public TestFixture(SharedAccountPolicy? shared = null)
        {
            Shared = shared ?? TestSharedAccounts.None;
            Repository = new FakeUserWorkflowRepository();
            Outbox = new FakeOutbox();
            Audit = new FakeAuditWriter();
            PermissionChecker = new FakePermissionChecker();
            Invitations.WorkspaceNames[TenantId] = "Acme";
            Handler = new UserWorkflowHandler(
                new FakeRequestContext(),
                PermissionChecker,
                Repository,
                Outbox,
                Audit,
                new FakeUnitOfWork(),
                new InvitationMailbox(
                    Invitations,
                    Mail,
                    new AccountEmailOptions { AppBaseUrl = new Uri("https://flowpro.test/") },
                    new FixedTimeProvider()),
                Invitations,
                Shared,
                new FixedTimeProvider());
        }

        public SharedAccountPolicy Shared { get; }

        public FakeInvitationStore Invitations { get; } = new();

        public FakeEmailQueue Mail { get; } = new();

        public UserWorkflowHandler Handler { get; }

        public FakeUserWorkflowRepository Repository { get; }

        public FakeOutbox Outbox { get; }

        public FakeAuditWriter Audit { get; }

        public FakePermissionChecker PermissionChecker { get; }
    }

    private sealed class FakeRequestContext : ICurrentRequestContext
    {
        public RequestIdentity GetRequiredIdentity() => new(TenantId, ActorUserId);

        public RequestIdentity? TryGetIdentity() => GetRequiredIdentity();
    }

    private sealed class FakeUnitOfWork : IUnitOfWork
    {
        public Task<TResult> ExecuteAsync<TResult>(
            Func<CancellationToken, Task<TResult>> operation,
            CancellationToken cancellationToken) =>
            operation(cancellationToken);
    }

    private sealed class FixedTimeProvider : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private sealed class FakeUserWorkflowRepository : IUserWorkflowRepository
    {
        public List<Membership> Users { get; } = [];

        public List<Employee> Employees { get; } = [];

        public List<Role> Roles { get; } = [];

        public List<Team> Teams { get; } = [];

        public List<UserRole> UserRoles { get; } = [];

        public List<UserDirectoryProjection> Projections { get; } = [];

        public Task<IReadOnlyList<UserDirectoryProjection>> ListAsync(
            Guid tenantId,
            CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<UserDirectoryProjection>>(Projections);

        public Task<UserDirectoryProjection?> FindProjectionAsync(
            Guid tenantId,
            string userId,
            CancellationToken cancellationToken) =>
            Task.FromResult<UserDirectoryProjection?>(null);

        public Task<UserDirectoryEntities?> FindEntitiesByClientIdOrEmailAsync(
            Guid tenantId,
            string clientId,
            string email,
            CancellationToken cancellationToken)
        {
            Membership? user = Users.FirstOrDefault(user =>
                user.TenantId == tenantId
                && (user.ExternalSubject == clientId || user.Email == email));
            Employee? employee = user is null
                ? null
                : Employees.SingleOrDefault(employee => employee.UserId == user.Id);

            return Task.FromResult(
                user is null || employee is null
                    ? null
                    : new UserDirectoryEntities(user, employee));
        }

        public Task<Role?> FindRoleByKeyAsync(
            Guid tenantId,
            string key,
            CancellationToken cancellationToken) =>
            Task.FromResult(Roles.SingleOrDefault(role =>
                role.TenantId == tenantId && role.Key == key));

        public Task<Team?> FindTeamByNameAsync(
            Guid tenantId,
            string name,
            CancellationToken cancellationToken) =>
            Task.FromResult(Teams.SingleOrDefault(team =>
                team.TenantId == tenantId && team.Name == name));

        public void AddUser(Membership user) => Users.Add(user);

        public void AddEmployee(Employee employee) => Employees.Add(employee);

        public void AddRole(Role role) => Roles.Add(role);

        public void AddTeam(Team team) => Teams.Add(team);

        public void ReplaceUserRole(Guid tenantId, Guid userId, Guid roleId)
        {
            UserRoles.RemoveAll(userRole =>
                userRole.TenantId == tenantId && userRole.UserId == userId);
            UserRoles.Add(new UserRole(tenantId, userId, roleId));
        }
    }

    private static UserDirectoryProjection CreateProjection(
        string id,
        string firstName,
        string lastName,
        string roleKey,
        string teamName,
        Guid? userId = null)
    {
        Membership user = new(
            TenantId,
            id,
            $"{firstName}.{lastName}@flowpro.test".ToLowerInvariant(),
            $"{firstName} {lastName}",
            userId);
        Employee employee = new(TenantId, user.Id, id, firstName, lastName);
        Role role = new(TenantId, roleKey, roleKey);
        Team team = new(TenantId, null, teamName, teamName);
        employee.UpdateProfile(id, firstName, lastName, team.Id, null, null, isActive: true);

        return new UserDirectoryProjection(user, employee, role, team);
    }

    private sealed class FakeOutbox : IOutboxWriter
    {
        public List<OutboxMessage> Messages { get; } = [];

        public void Add(OutboxMessage message) => Messages.Add(message);
    }

    private sealed class FakeAuditWriter : IAuditWriter
    {
        public List<AuditEvent> Events { get; } = [];

        public void Add(AuditEvent auditEvent) => Events.Add(auditEvent);
    }

    private sealed class FakePermissionChecker : IPermissionChecker
    {
        public HashSet<string> DeniedPermissions { get; } = [];

        public Task<bool> HasPermissionAsync(
            Guid tenantId,
            Guid userId,
            string permission,
            CancellationToken cancellationToken) =>
            Task.FromResult(!DeniedPermissions.Contains(permission));
    }
}
