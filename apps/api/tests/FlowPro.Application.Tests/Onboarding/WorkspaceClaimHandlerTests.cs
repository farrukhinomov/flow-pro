using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Onboarding;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Onboarding;
using FlowPro.Domain.Organization;
using FlowPro.Domain.Tenancy;

namespace FlowPro.Application.Tests.Onboarding;

public sealed class WorkspaceClaimHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 7, 30, 8, 0, 0, TimeSpan.Zero);

    private static readonly PrincipalIdentity Principal = new(
        "subject-1",
        "marta@acme.de",
        "Marta Lindgren");

    [Fact]
    public async Task Claim_state_suggests_a_workspace_from_the_business_email_domain()
    {
        TestFixture fixture = new(Principal);

        WorkspaceClaimState state = await fixture.Handler.HandleAsync(
            new GetWorkspaceClaimStateQuery(),
            CancellationToken.None);

        Assert.False(state.HasWorkspace);
        Assert.Equal("marta@acme.de", state.Email);
        Assert.Equal("Acme", state.SuggestedWorkspaceName);
        Assert.Equal("acme", state.SuggestedSlug);
    }

    [Fact]
    public async Task Claim_state_falls_back_to_the_display_name_for_consumer_mailboxes()
    {
        TestFixture fixture = new(
            new PrincipalIdentity("subject-2", "marta@gmail.com", "Marta Lindgren"));

        WorkspaceClaimState state = await fixture.Handler.HandleAsync(
            new GetWorkspaceClaimStateQuery(),
            CancellationToken.None);

        Assert.Equal("Marta Lindgren Workspace", state.SuggestedWorkspaceName);
        Assert.Equal("marta-lindgren-workspace", state.SuggestedSlug);
    }

    [Fact]
    public async Task Claim_state_reports_an_existing_workspace()
    {
        TestFixture fixture = new(Principal);
        fixture.Repository.Users.Add(
            new Membership(Guid.CreateVersion7(), Principal.ExternalSubject, Principal.Email, "Marta"));

        WorkspaceClaimState state = await fixture.Handler.HandleAsync(
            new GetWorkspaceClaimStateQuery(),
            CancellationToken.None);

        Assert.True(state.HasWorkspace);
    }

    [Fact]
    public async Task Claiming_with_an_account_links_the_owner_membership_to_it()
    {
        Guid accountId = Guid.CreateVersion7();
        TestFixture fixture = new(
            new PrincipalIdentity(accountId.ToString(), "ada@acme.de", "Ada Lovelace", accountId));

        await fixture.Handler.HandleAsync(new ClaimWorkspaceCommand("Acme GmbH"), CancellationToken.None);

        Membership owner = Assert.Single(fixture.Repository.Users);
        Assert.Equal(accountId, owner.AccountId);
    }

    [Fact]
    public async Task An_account_that_already_has_a_membership_cannot_claim_a_second_workspace()
    {
        Guid accountId = Guid.CreateVersion7();
        TestFixture fixture = new(
            new PrincipalIdentity(accountId.ToString(), "ada@acme.de", "Ada Lovelace", accountId));
        Membership existing = new(Guid.CreateVersion7(), "seeded-subject", "ada@acme.de", "Ada");
        existing.LinkAccount(accountId);
        fixture.Repository.Users.Add(existing);

        FlowProConflictException exception = await Assert.ThrowsAsync<FlowProConflictException>(
            () => fixture.Handler.HandleAsync(new ClaimWorkspaceCommand("Acme GmbH"), CancellationToken.None));

        Assert.Equal("onboarding.workspace_already_claimed", exception.Code);
    }

    [Fact]
    public async Task Claiming_provisions_tenant_owner_employee_and_onboarding()
    {
        TestFixture fixture = new(Principal);

        WorkspaceClaimResult result = await fixture.Handler.HandleAsync(
            new ClaimWorkspaceCommand("Acme GmbH"),
            CancellationToken.None);

        Tenant tenant = Assert.Single(fixture.Repository.Tenants);
        Membership owner = Assert.Single(fixture.Repository.Users);
        Employee employee = Assert.Single(fixture.Repository.Employees);
        TenantOnboarding onboarding = Assert.Single(fixture.Repository.Onboardings);

        Assert.Equal(result.TenantId, tenant.Id);
        Assert.Equal("acme-gmbh", tenant.Slug);
        Assert.Equal("Acme GmbH", tenant.Name);
        Assert.Equal(Principal.ExternalSubject, owner.ExternalSubject);
        Assert.Equal(Principal.Email, owner.Email);
        Assert.Equal("Marta", employee.GivenName);
        Assert.Equal("Lindgren", employee.FamilyName);
        Assert.Equal(tenant.Id, onboarding.TenantId);
        Assert.Equal("in-progress", result.Onboarding.Status);
        Assert.Equal("company", result.Onboarding.CurrentStep);
    }

    [Fact]
    public async Task Provisioning_runs_inside_the_new_tenant_row_level_security_scope()
    {
        TestFixture fixture = new(Principal);

        WorkspaceClaimResult result = await fixture.Handler.HandleAsync(
            new ClaimWorkspaceCommand("Acme GmbH"),
            CancellationToken.None);

        Assert.Equal([result.TenantId], fixture.UnitOfWork.ScopedTenantIds);
    }

    [Fact]
    public async Task Claiming_seeds_default_roles_and_grants_the_owner_superadmin()
    {
        TestFixture fixture = new(Principal);

        await fixture.Handler.HandleAsync(
            new ClaimWorkspaceCommand("Acme GmbH"),
            CancellationToken.None);

        Assert.Equal(
            [PermissionCatalog.SuperadminRoleKey, PermissionCatalog.ManagerRoleKey, PermissionCatalog.EmployeeRoleKey],
            fixture.Repository.Roles.Select(role => role.Key));

        Role superadmin = fixture.Repository.Roles.Single(
            role => role.Key == PermissionCatalog.SuperadminRoleKey);
        UserRole assignment = Assert.Single(fixture.Repository.UserRoles);

        Assert.Equal(superadmin.Id, assignment.RoleId);
        Assert.Equal(
            PermissionKeys.All.Count,
            fixture.Repository.RolePermissions.Count(
                rolePermission => rolePermission.RoleId == superadmin.Id));
    }

    [Fact]
    public async Task Claiming_reuses_existing_global_permission_rows()
    {
        TestFixture fixture = new(Principal);
        Permission existing = new(
            PermissionKeys.AttendanceClockSelf,
            PermissionCatalog.Describe(PermissionKeys.AttendanceClockSelf));
        fixture.Repository.Permissions.Add(existing);

        await fixture.Handler.HandleAsync(
            new ClaimWorkspaceCommand("Acme GmbH"),
            CancellationToken.None);

        Assert.Equal(PermissionKeys.All.Count, fixture.Repository.Permissions.Count);
        Assert.Single(
            fixture.Repository.Permissions,
            permission => permission.Key == PermissionKeys.AttendanceClockSelf);
    }

    [Fact]
    public async Task Claiming_seeds_the_organization_catalog_defaults()
    {
        TestFixture fixture = new(Principal);

        await fixture.Handler.HandleAsync(
            new ClaimWorkspaceCommand("Acme GmbH"),
            CancellationToken.None);

        Assert.Single(fixture.Repository.Locations, location => location.Code == "HQ");
        Assert.Single(fixture.Repository.Teams);
        Assert.Equal(5, fixture.Repository.RoleProfiles.Count);
        Assert.Contains(
            fixture.Repository.WorkPatterns,
            pattern => pattern.ExternalId == OnboardingDefaults.DefaultWorkPatternExternalId
                && pattern.WeeklyMinutes == OnboardingDefaults.DefaultWeeklyMinutes);
    }

    [Fact]
    public async Task Claiming_writes_audit_and_outbox_records()
    {
        TestFixture fixture = new(Principal);

        WorkspaceClaimResult result = await fixture.Handler.HandleAsync(
            new ClaimWorkspaceCommand("Acme GmbH"),
            CancellationToken.None);

        Assert.Single(fixture.Audit.Events, item =>
            item.Action == "onboarding.workspace.claimed.v1" && item.TenantId == result.TenantId);
        Assert.Single(fixture.Outbox.Messages, item =>
            item.EventType == "onboarding.workspace.claimed.v1" && item.TenantId == result.TenantId);
    }

    [Fact]
    public async Task Slug_collisions_are_resolved_with_a_numeric_suffix()
    {
        TestFixture fixture = new(Principal);
        fixture.Repository.ReservedSlugs.Add("acme-gmbh");
        fixture.Repository.ReservedSlugs.Add("acme-gmbh-2");

        await fixture.Handler.HandleAsync(
            new ClaimWorkspaceCommand("Acme GmbH"),
            CancellationToken.None);

        Assert.Equal("acme-gmbh-3", Assert.Single(fixture.Repository.Tenants).Slug);
    }

    [Fact]
    public async Task An_account_cannot_claim_a_second_workspace()
    {
        TestFixture fixture = new(Principal);
        fixture.Repository.Users.Add(
            new Membership(Guid.CreateVersion7(), Principal.ExternalSubject, Principal.Email, "Marta"));

        FlowProConflictException exception = await Assert.ThrowsAsync<FlowProConflictException>(
            () => fixture.Handler.HandleAsync(
                new ClaimWorkspaceCommand("Acme GmbH"),
                CancellationToken.None));

        Assert.Equal("onboarding.workspace_already_claimed", exception.Code);
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("A")]
    public async Task Workspace_names_are_validated(string workspaceName)
    {
        TestFixture fixture = new(Principal);

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.Handler.HandleAsync(
                new ClaimWorkspaceCommand(workspaceName),
                CancellationToken.None));

        Assert.Equal("onboarding.workspace_name_required", exception.Code);
    }

    [Fact]
    public async Task An_unauthenticated_principal_cannot_claim()
    {
        TestFixture fixture = new(null);

        await Assert.ThrowsAsync<FlowProUnauthorizedException>(
            () => fixture.Handler.HandleAsync(
                new ClaimWorkspaceCommand("Acme GmbH"),
                CancellationToken.None));
    }

    private sealed class TestFixture
    {
        public TestFixture(PrincipalIdentity? principal)
        {
            Repository = new FakeOnboardingRepository();
            Audit = new FakeOnboardingAuditWriter();
            Outbox = new FakeOnboardingOutbox();
            UnitOfWork = new FakeProvisioningUnitOfWork();
            Handler = new WorkspaceClaimHandler(
                new FakeCurrentPrincipal(principal),
                Repository,
                new WorkspaceProvisioner(Repository),
                Audit,
                Outbox,
                UnitOfWork,
                new FixedOnboardingTimeProvider(Now));
        }

        public WorkspaceClaimHandler Handler { get; }

        public FakeOnboardingRepository Repository { get; }

        public FakeOnboardingAuditWriter Audit { get; }

        public FakeOnboardingOutbox Outbox { get; }

        public FakeProvisioningUnitOfWork UnitOfWork { get; }
    }
}
