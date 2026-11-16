using FlowPro.Application.Audit;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Integration;
using FlowPro.Application.Organization;
using FlowPro.Domain.Audit;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Integration;
using FlowPro.Domain.Organization;

namespace FlowPro.Application.Tests.Organization;

public sealed class OrganizationCatalogHandlerTests
{
    private static readonly Guid TenantId = Guid.Parse("01975fa8-7590-7000-8000-000000006001");
    private static readonly Guid ActorUserId = Guid.Parse("01975fa8-7590-7000-8000-000000006002");
    private static readonly DateTimeOffset Now = new(2026, 6, 13, 9, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task SaveRecordWritesRoleProfileAndServerEvents()
    {
        TestFixture fixture = new();

        OrganizationCatalogRecordDto result = await fixture.Handler.HandleAsync(
            new SaveOrganizationCatalogRecordCommand(
                new OrganizationCatalogRecordDto(
                    "role-profile-lead",
                    "role-profile",
                    null,
                    "Team Lead",
                    null,
                    "Can approve team requests.",
                    "active",
                    "manager",
                    null,
                    null,
                    null,
                    Now,
                    Now)),
            CancellationToken.None);

        Assert.Equal("role-profile-lead", result.Id);
        Assert.Single(fixture.Repository.RoleProfiles);
        Assert.Equal("organization.catalog.saved.v1", Assert.Single(fixture.Outbox.Messages).EventType);
        Assert.Equal("organization.catalog.saved.v1", Assert.Single(fixture.Audit.Events).Action);
    }

    [Fact]
    public async Task SaveRecordWritesDepartmentAndLocationCatalogs()
    {
        TestFixture fixture = new();

        OrganizationCatalogRecordDto department = await fixture.Handler.HandleAsync(
            new SaveOrganizationCatalogRecordCommand(
                new OrganizationCatalogRecordDto(
                    "department-people",
                    "department",
                    "people",
                    null,
                    "People",
                    null,
                    "active",
                    null,
                    null,
                    null,
                    null,
                    Now,
                    Now)),
            CancellationToken.None);
        OrganizationCatalogRecordDto location = await fixture.Handler.HandleAsync(
            new SaveOrganizationCatalogRecordCommand(
                new OrganizationCatalogRecordDto(
                    "location-berlin",
                    "location",
                    "berlin",
                    null,
                    "Berlin",
                    null,
                    "active",
                    null,
                    null,
                    "Europe/Berlin",
                    null,
                    Now,
                    Now)),
            CancellationToken.None);

        Assert.Equal("PEOPLE", department.Code);
        Assert.Equal("BERLIN", location.Code);
        Assert.Equal("Europe/Berlin", location.TimeZoneId);
        Assert.Single(fixture.Repository.Departments);
        Assert.Single(fixture.Repository.Locations);
        Assert.Equal(2, fixture.Outbox.Messages.Count);
        Assert.All(fixture.Outbox.Messages, message => Assert.Equal("organization.catalog.saved.v1", message.EventType));
    }

    [Fact]
    public async Task SetManagerDelegationsReplacesActiveDelegatedTeams()
    {
        TestFixture fixture = new();
        Membership manager = new(TenantId, "usr-manager", "manager@example.com", "Manager Person");
        Team support = new(TenantId, null, "SUPPORT", "Support", externalId: "team-support");
        Team platform = new(TenantId, null, "PLATFORM", "Platform", externalId: "team-platform");
        fixture.Repository.Users.Add(manager);
        fixture.Repository.Teams.AddRange([support, platform]);

        ManagerDelegationPage result = await fixture.Handler.HandleAsync(
            new SetManagerDelegationsCommand("usr-manager", ["Support", "Platform"]),
            CancellationToken.None);

        Assert.Equal(2, result.Items.Count);
        Assert.All(fixture.Repository.Delegations, delegation => Assert.True(delegation.IsActive));
        Assert.Equal("organization.manager_delegations.updated.v1", Assert.Single(fixture.Outbox.Messages).EventType);
    }

    [Fact]
    public async Task SaveRecordRequiresOrganizationManagePermission()
    {
        TestFixture fixture = new();
        fixture.PermissionChecker.DeniedPermissions.Add(PermissionKeys.OrganizationManage);

        await Assert.ThrowsAsync<FlowProForbiddenException>(
            () => fixture.Handler.HandleAsync(
                new SaveOrganizationCatalogRecordCommand(
                    new OrganizationCatalogRecordDto(
                        "work-pattern-denied",
                        "work-pattern",
                        null,
                        "Denied",
                        null,
                        null,
                        "active",
                        null,
                        null,
                        null,
                        40,
                        Now,
                        Now)),
                CancellationToken.None));

        Assert.Empty(fixture.Repository.WorkPatterns);
        Assert.Empty(fixture.Outbox.Messages);
    }

    private sealed class TestFixture
    {
        public TestFixture()
        {
            Repository = new FakeOrganizationCatalogRepository();
            Outbox = new FakeOutbox();
            Audit = new FakeAuditWriter();
            PermissionChecker = new FakePermissionChecker();
            Handler = new OrganizationCatalogHandler(
                new FakeRequestContext(),
                PermissionChecker,
                Repository,
                Outbox,
                Audit,
                new FakeUnitOfWork(),
                new FixedTimeProvider());
        }

        public OrganizationCatalogHandler Handler { get; }

        public FakeOrganizationCatalogRepository Repository { get; }

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

    private sealed class FakeOrganizationCatalogRepository : IOrganizationCatalogRepository
    {
        public List<Department> Departments { get; } = [];

        public List<Location> Locations { get; } = [];

        public List<RoleProfile> RoleProfiles { get; } = [];

        public List<Team> Teams { get; } = [];

        public List<WorkPattern> WorkPatterns { get; } = [];

        public List<ManagerDelegation> Delegations { get; } = [];

        public List<Membership> Users { get; } = [];

        public Task<OrganizationCatalogSnapshot> LoadAsync(
            Guid tenantId,
            CancellationToken cancellationToken) =>
            Task.FromResult(
                new OrganizationCatalogSnapshot(
                    Departments,
                    Locations,
                    RoleProfiles,
                    Teams.Select(team => new TeamProjection(
                            team,
                            team.ManagerUserId is Guid managerId
                                ? Users.SingleOrDefault(user => user.Id == managerId)
                                : null))
                        .ToArray(),
                    WorkPatterns,
                    Delegations
                        .Where(delegation => delegation.IsActive)
                        .Select(delegation => new ManagerDelegationProjection(
                            delegation,
                            Users.Single(user => user.Id == delegation.ManagerUserId),
                            Teams.Single(team => team.Id == delegation.TeamId)))
                        .ToArray()));

        public Task<RoleProfile?> FindRoleProfileAsync(
            Guid tenantId,
            string externalId,
            CancellationToken cancellationToken) =>
            Task.FromResult(RoleProfiles.SingleOrDefault(profile => profile.ExternalId == externalId));

        public Task<Department?> FindDepartmentAsync(
            Guid tenantId,
            string externalId,
            string code,
            CancellationToken cancellationToken)
        {
            string normalizedCode = code.ToUpperInvariant();
            return Task.FromResult(
                Departments.SingleOrDefault(department => department.Code == normalizedCode));
        }

        public Task<Location?> FindLocationAsync(
            Guid tenantId,
            string externalId,
            string code,
            CancellationToken cancellationToken)
        {
            string normalizedCode = code.ToUpperInvariant();
            return Task.FromResult(
                Locations.SingleOrDefault(location => location.Code == normalizedCode));
        }

        public Task<Team?> FindTeamAsync(
            Guid tenantId,
            string externalId,
            string name,
            CancellationToken cancellationToken) =>
            Task.FromResult(Teams.SingleOrDefault(team => team.ExternalId == externalId || team.Name == name));

        public Task<WorkPattern?> FindWorkPatternAsync(
            Guid tenantId,
            string externalId,
            CancellationToken cancellationToken) =>
            Task.FromResult(WorkPatterns.SingleOrDefault(pattern => pattern.ExternalId == externalId));

        public Task<Membership?> FindUserByExternalIdAsync(
            Guid tenantId,
            string externalId,
            CancellationToken cancellationToken) =>
            Task.FromResult(Users.SingleOrDefault(user => user.ExternalSubject == externalId));

        public Task<IReadOnlyList<ManagerDelegation>> ListManagerDelegationsAsync(
            Guid tenantId,
            Guid managerUserId,
            CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<ManagerDelegation>>(
                Delegations.Where(delegation => delegation.ManagerUserId == managerUserId).ToArray());

        public void AddRoleProfile(RoleProfile profile) => RoleProfiles.Add(profile);

        public void AddDepartment(Department department) => Departments.Add(department);

        public void AddLocation(Location location) => Locations.Add(location);

        public void AddTeam(Team team) => Teams.Add(team);

        public void AddWorkPattern(WorkPattern pattern) => WorkPatterns.Add(pattern);

        public void AddManagerDelegation(ManagerDelegation delegation) => Delegations.Add(delegation);
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
