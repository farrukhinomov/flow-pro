using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Onboarding;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Onboarding;
using FlowPro.Domain.Organization;
using FlowPro.Domain.Tenancy;

namespace FlowPro.Application.Demo;

/// <summary>The database operations the demo reset needs beyond ordinary repositories.</summary>
public interface IDemoDatabase
{
    /// <summary>Whether any workspace other than the demo's exists.</summary>
    Task<bool> HoldsOtherWorkspacesAsync(Guid demoTenantId, CancellationToken cancellationToken);

    Task<bool> HasWorkspaceAsync(Guid tenantId, CancellationToken cancellationToken);

    /// <summary>
    /// Deletes every row of every FlowPro table, leaving the schema and its migrations. Runs in the
    /// caller's transaction.
    /// </summary>
    Task WipeAsync(CancellationToken cancellationToken);
}

/// <summary>Creates the demo's accounts, which ordinary sign-up cannot: fixed ids, address confirmed.</summary>
public interface IDemoAccountWriter
{
    void Add(DemoLogin login, string password);
}

public enum DemoResetOutcome
{
    /// <summary>The demo is off; nothing was touched.</summary>
    Disabled,

    /// <summary>The demo workspace already existed and only a missing one was asked for.</summary>
    AlreadySeeded,

    /// <summary>The database was wiped and the demo seeded again.</summary>
    Reset,

    /// <summary>
    /// The database holds other workspaces, so this is not a demo database; nothing was touched.
    /// </summary>
    RefusedOtherWorkspaces,
}

/// <summary>
/// Wipes the database and seeds the demo workspace again.
/// </summary>
/// <remarks>
/// Wiping is only safe on a database that holds nothing but the demo. Before every wipe the reset
/// checks that no other workspace exists, so turning <see cref="DemoOptions.Enabled" /> on for an
/// instance with real data by mistake destroys nothing. Visitors cannot create workspaces, since
/// the demo needs registration off.
/// </remarks>
public sealed class DemoReset(
    IDemoDatabase database,
    IDemoAccountWriter accounts,
    IDemoSampleWriter samples,
    IOnboardingRepository repository,
    WorkspaceProvisioner provisioner,
    IProvisioningUnitOfWork unitOfWork,
    DemoOptions options,
    TimeProvider timeProvider)
{
    /// <param name="onlyIfMissing">Seed only when there is no demo workspace yet, as on first start.</param>
    public async Task<DemoResetOutcome> ResetAsync(bool onlyIfMissing, CancellationToken cancellationToken)
    {
        if (!options.Enabled)
        {
            return DemoResetOutcome.Disabled;
        }

        if (await database.HoldsOtherWorkspacesAsync(DemoWorkspace.TenantId, cancellationToken))
        {
            return DemoResetOutcome.RefusedOtherWorkspaces;
        }

        if (onlyIfMissing && await database.HasWorkspaceAsync(DemoWorkspace.TenantId, cancellationToken))
        {
            return DemoResetOutcome.AlreadySeeded;
        }

        await WipeAndSeedAsync(cancellationToken);
        return DemoResetOutcome.Reset;
    }

    // One transaction: if seeding fails, the wipe is rolled back and the old demo stays.
    private Task<int> WipeAndSeedAsync(CancellationToken cancellationToken) =>
        unitOfWork.ExecuteInTenantScopeAsync(
            DemoWorkspace.TenantId,
            async transactionCancellationToken =>
            {
                await database.WipeAsync(transactionCancellationToken);
                DateTimeOffset now = timeProvider.GetUtcNow();
                Guid tenantId = DemoWorkspace.TenantId;
                Dictionary<DemoLogin, Membership> logins = [];
                List<DemoMember> members = [];

                foreach (DemoLogin login in DemoWorkspace.Logins)
                {
                    accounts.Add(login, options.Password!);

                    Membership user = AddMember(
                        $"demo-{login.RoleKey}",
                        login.Email,
                        login.GivenName,
                        login.FamilyName,
                        login.PersonnelNumber,
                        login.Team,
                        DemoColleague.FullTimeWeeklyMinutes,
                        members);
                    user.LinkAccount(login.AccountId);
                    logins[login] = user;
                }

                foreach (DemoColleague colleague in DemoWorkspace.Colleagues)
                {
                    _ = AddMember(
                        $"demo-{colleague.PersonnelNumber}",
                        colleague.Email,
                        colleague.GivenName,
                        colleague.FamilyName,
                        colleague.PersonnelNumber,
                        colleague.Team,
                        colleague.WeeklyMinutes,
                        members);
                }

                DemoLogin owner = DemoWorkspace.Logins.Single(
                    login => login.RoleKey == PermissionCatalog.SuperadminRoleKey);
                IReadOnlyDictionary<string, Guid> roleIds = await provisioner.ProvisionAsync(
                    new Tenant(DemoWorkspace.Slug, DemoWorkspace.Name, tenantId),
                    logins[owner].Id,
                    transactionCancellationToken);

                foreach (DemoMember member in members.Where(member => member.User != logins[owner]))
                {
                    string roleKey = DemoWorkspace.Logins
                        .SingleOrDefault(login => login.PersonnelNumber == member.Employee.PersonnelNumber)?.RoleKey
                        ?? PermissionCatalog.EmployeeRoleKey;
                    repository.AddUserRole(new UserRole(tenantId, member.User.Id, roleIds[roleKey]));
                }

                samples.Add(DemoSampleData.Build(tenantId, members, now));

                // Visitors land in a working app, not in the setup wizard.
                TenantOnboarding onboarding = new(tenantId, logins[owner].Id);
                onboarding.Complete(now);
                repository.AddOnboarding(onboarding);

                return 0;
            },
            cancellationToken);

    private Membership AddMember(
        string externalSubject,
        string email,
        string givenName,
        string familyName,
        string personnelNumber,
        DemoTeam team,
        int weeklyMinutes,
        List<DemoMember> members)
    {
        Guid tenantId = DemoWorkspace.TenantId;
        Membership user = new(tenantId, externalSubject, email, $"{givenName} {familyName}");
        Employee employee = new(tenantId, user.Id, personnelNumber, givenName, familyName);
        repository.AddUser(user);
        repository.AddEmployee(employee);
        members.Add(new DemoMember(user, employee, team, weeklyMinutes));

        return user;
    }
}

/// <summary>When the next nightly reset is due.</summary>
public static class DemoSchedule
{
    public static TimeSpan UntilNext(TimeOnly resetAtUtc, DateTimeOffset now)
    {
        DateTimeOffset utcNow = now.ToUniversalTime();
        DateTimeOffset today = new(DateOnly.FromDateTime(utcNow.UtcDateTime), resetAtUtc, TimeSpan.Zero);
        DateTimeOffset next = today > utcNow ? today : today.AddDays(1);

        return next - utcNow;
    }
}
