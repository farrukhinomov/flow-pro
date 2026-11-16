using FlowPro.Application.Demo;
using FlowPro.Application.Identity;
using FlowPro.Application.Onboarding;
using FlowPro.Application.Tests.Onboarding;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Onboarding;

namespace FlowPro.Application.Tests.Demo;

public sealed class DemoResetTests
{
    private const string Password = "a public demo password";

    private static readonly DateTimeOffset Now = new(2026, 11, 14, 3, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Nothing_happens_while_the_demo_is_off()
    {
        Fixture fixture = new(enabled: false);

        Assert.Equal(DemoResetOutcome.Disabled, await fixture.Reset.ResetAsync(onlyIfMissing: false, CancellationToken.None));
        Assert.Equal(0, fixture.Database.Wipes);
    }

    [Fact]
    public async Task A_database_with_other_workspaces_is_never_wiped()
    {
        Fixture fixture = new();
        fixture.Database.OtherWorkspaces = true;

        Assert.Equal(
            DemoResetOutcome.RefusedOtherWorkspaces,
            await fixture.Reset.ResetAsync(onlyIfMissing: false, CancellationToken.None));
        Assert.Equal(0, fixture.Database.Wipes);
        Assert.Empty(fixture.Repository.Tenants);
    }

    [Fact]
    public async Task On_start_an_existing_demo_is_kept()
    {
        Fixture fixture = new();
        fixture.Database.DemoExists = true;

        Assert.Equal(DemoResetOutcome.AlreadySeeded, await fixture.Reset.ResetAsync(onlyIfMissing: true, CancellationToken.None));
        Assert.Equal(0, fixture.Database.Wipes);
    }

    [Fact]
    public async Task A_reset_wipes_then_seeds_a_finished_workspace_with_one_login_per_role()
    {
        Fixture fixture = new();
        fixture.Database.DemoExists = true;

        Assert.Equal(DemoResetOutcome.Reset, await fixture.Reset.ResetAsync(onlyIfMissing: false, CancellationToken.None));

        Assert.Equal(1, fixture.Database.Wipes);
        Assert.Equal([DemoWorkspace.TenantId], fixture.UnitOfWork.ScopedTenantIds);
        Assert.Equal(DemoWorkspace.Name, Assert.Single(fixture.Repository.Tenants).Name);
        Assert.Equal(DemoWorkspace.Logins.Select(login => login.AccountId), fixture.Accounts.Added.Select(login => login.AccountId));
        Assert.All(fixture.Accounts.Passwords, password => Assert.Equal(Password, password));

        foreach (DemoLogin login in DemoWorkspace.Logins)
        {
            Membership member = Assert.Single(fixture.Repository.Users, user => user.AccountId == login.AccountId);
            Assert.Equal(login.Email, member.Email);
            Assert.Equal(UserStatus.Active, member.Status);
            Guid roleId = Assert.Single(fixture.Repository.UserRoles, userRole => userRole.UserId == member.Id).RoleId;
            Assert.Equal(login.RoleKey, Assert.Single(fixture.Repository.Roles, role => role.Id == roleId).Key);
        }

        Assert.Equal(
            DemoWorkspace.Logins.Count + DemoWorkspace.Colleagues.Count,
            fixture.Repository.Employees.Count);
        Assert.Equal(OnboardingStatus.Completed, Assert.Single(fixture.Repository.Onboardings).Status);
    }

    [Fact]
    public async Task Colleagues_get_the_employee_role_and_everyone_gets_sample_data()
    {
        Fixture fixture = new();

        await fixture.Reset.ResetAsync(onlyIfMissing: false, CancellationToken.None);

        Guid employeeRoleId = Assert.Single(
            fixture.Repository.Roles,
            role => role.Key == PermissionCatalog.EmployeeRoleKey).Id;
        foreach (DemoColleague colleague in DemoWorkspace.Colleagues)
        {
            Membership member = Assert.Single(fixture.Repository.Users, user => user.Email == colleague.Email);
            Assert.Null(member.AccountId);
            Assert.Equal(employeeRoleId, Assert.Single(fixture.Repository.UserRoles, userRole => userRole.UserId == member.Id).RoleId);
        }

        DemoSample sample = Assert.Single(fixture.Samples.Added);
        Assert.Equal(fixture.Repository.Employees.Count, sample.Contracts.Count);
        Assert.Equal(fixture.Repository.Employees.Count, sample.AttendanceStates.Count);
        Assert.NotEmpty(sample.Bookings);
        Assert.NotEmpty(sample.Records);
    }

    [Fact]
    public void Every_role_a_workspace_gets_has_a_demo_login()
    {
        Assert.Equal(
            [PermissionCatalog.SuperadminRoleKey, PermissionCatalog.ManagerRoleKey, PermissionCatalog.EmployeeRoleKey],
            DemoWorkspace.Logins.Select(login => login.RoleKey));
        Assert.All(DemoWorkspace.Logins, login => Assert.EndsWith("@demo.invalid", login.Email, StringComparison.Ordinal));
        Assert.All(DemoWorkspace.Colleagues, colleague => Assert.EndsWith("@demo.invalid", colleague.Email, StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("2026-11-14T02:00:00Z", 1.0)]
    [InlineData("2026-11-14T03:00:00Z", 24.0)]
    [InlineData("2026-11-14T15:30:00Z", 11.5)]
    public void The_next_reset_is_the_next_time_the_clock_reaches_the_reset_time(string now, double hours)
    {
        TimeSpan wait = DemoSchedule.UntilNext(new TimeOnly(3, 0), DateTimeOffset.Parse(now, System.Globalization.CultureInfo.InvariantCulture));

        Assert.Equal(TimeSpan.FromHours(hours), wait);
    }

    [Fact]
    public void Settings_that_cannot_run_a_demo_are_refused()
    {
        new DemoOptions().Validate(registrationEnabled: true);
        new DemoOptions { Enabled = true, Password = Password }.Validate(registrationEnabled: false);

        Assert.Throws<InvalidOperationException>(
            () => new DemoOptions { Enabled = true, Password = "short" }.Validate(registrationEnabled: false));
        Assert.Throws<InvalidOperationException>(
            () => new DemoOptions { Enabled = true, Password = Password }.Validate(registrationEnabled: true));
    }

    private sealed class Fixture
    {
        public Fixture(bool enabled = true)
        {
            Reset = new DemoReset(
                Database,
                Accounts,
                Samples,
                Repository,
                new WorkspaceProvisioner(Repository),
                UnitOfWork,
                new DemoOptions { Enabled = enabled, Password = Password },
                new FixedOnboardingTimeProvider(Now));
        }

        public FakeDemoDatabase Database { get; } = new();

        public FakeDemoAccounts Accounts { get; } = new();

        public FakeDemoSamples Samples { get; } = new();

        public FakeOnboardingRepository Repository { get; } = new();

        public FakeProvisioningUnitOfWork UnitOfWork { get; } = new();

        public DemoReset Reset { get; }
    }

    private sealed class FakeDemoDatabase : IDemoDatabase
    {
        public bool OtherWorkspaces { get; set; }

        public bool DemoExists { get; set; }

        public int Wipes { get; private set; }

        public Task<bool> HoldsOtherWorkspacesAsync(Guid demoTenantId, CancellationToken cancellationToken) =>
            Task.FromResult(OtherWorkspaces);

        public Task<bool> HasWorkspaceAsync(Guid tenantId, CancellationToken cancellationToken) =>
            Task.FromResult(DemoExists);

        public Task WipeAsync(CancellationToken cancellationToken)
        {
            Wipes++;
            return Task.CompletedTask;
        }
    }

    private sealed class FakeDemoAccounts : IDemoAccountWriter
    {
        public List<DemoLogin> Added { get; } = [];

        public List<string> Passwords { get; } = [];

        public void Add(DemoLogin login, string password)
        {
            Added.Add(login);
            Passwords.Add(password);
        }
    }

    private sealed class FakeDemoSamples : IDemoSampleWriter
    {
        public List<DemoSample> Added { get; } = [];

        public void Add(DemoSample sample) => Added.Add(sample);
    }
}
