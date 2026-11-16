using FlowPro.Application.Identity;

namespace FlowPro.Application.Demo;

/// <summary>
/// The public demo: one workspace with a shared login per role, wiped and seeded again every
/// night. Off unless <see cref="DemoOptions.Enabled" /> is set.
/// </summary>
/// <remarks>
/// The people are fictional, and their addresses use the reserved <c>.invalid</c> top-level
/// domain, so no email to them can ever be delivered.
/// </remarks>
public static class DemoWorkspace
{
    public static readonly Guid TenantId = new("6f1c0de0-0000-4000-8000-00000000d000");

    public const string Slug = "flowpro-demo";

    public const string Name = "FlowPro Demo";

    public static IReadOnlyList<DemoLogin> Logins { get; } =
    [
        new(
            new Guid("6f1c0de0-0000-4000-8000-00000000d001"),
            PermissionCatalog.SuperadminRoleKey,
            "alex.morgan@demo.invalid",
            "Alex",
            "Morgan",
            "DEMO-001",
            DemoTeam.Product),
        new(
            new Guid("6f1c0de0-0000-4000-8000-00000000d002"),
            PermissionCatalog.ManagerRoleKey,
            "sam.rivera@demo.invalid",
            "Sam",
            "Rivera",
            "DEMO-002",
            DemoTeam.CustomerSuccess),
        new(
            new Guid("6f1c0de0-0000-4000-8000-00000000d003"),
            PermissionCatalog.EmployeeRoleKey,
            "jamie.chen@demo.invalid",
            "Jamie",
            "Chen",
            "DEMO-003",
            DemoTeam.CustomerSuccess),
    ];

    /// <summary>Colleagues without a login, so the team views, approvals and reports have people in them.</summary>
    public static IReadOnlyList<DemoColleague> Colleagues { get; } =
    [
        new("Priya", "Nair", "priya.nair@demo.invalid", "DEMO-004", DemoTeam.CustomerSuccess, DemoColleague.FullTimeWeeklyMinutes),
        new("Lukas", "Becker", "lukas.becker@demo.invalid", "DEMO-005", DemoTeam.CustomerSuccess, DemoColleague.FullTimeWeeklyMinutes),
        new("Emma", "Novak", "emma.novak@demo.invalid", "DEMO-006", DemoTeam.CustomerSuccess, 1_800),
        new("Sofia", "Rossi", "sofia.rossi@demo.invalid", "DEMO-007", DemoTeam.Product, DemoColleague.FullTimeWeeklyMinutes),
        new("Daniel", "Okafor", "daniel.okafor@demo.invalid", "DEMO-008", DemoTeam.Product, DemoColleague.FullTimeWeeklyMinutes),
    ];

    public static bool IsDemoAccount(Guid accountId) =>
        Logins.Any(login => login.AccountId == accountId);
}

/// <param name="RoleKey">One of the roles every workspace gets, see <see cref="PermissionCatalog" />.</param>
public sealed record DemoLogin(
    Guid AccountId,
    string RoleKey,
    string Email,
    string GivenName,
    string FamilyName,
    string PersonnelNumber,
    DemoTeam Team)
{
    public string DisplayName => $"{GivenName} {FamilyName}";
}

/// <summary>A demo colleague nobody signs in as.</summary>
public sealed record DemoColleague(
    string GivenName,
    string FamilyName,
    string Email,
    string PersonnelNumber,
    DemoTeam Team,
    int WeeklyMinutes)
{
    public const int FullTimeWeeklyMinutes = 2_400;

    public string DisplayName => $"{GivenName} {FamilyName}";
}

/// <summary>The demo's teams. The superadmin leads Product and the manager leads Customer Success.</summary>
public enum DemoTeam
{
    Product,
    CustomerSuccess,
}

/// <summary>Bound from the <c>Demo</c> configuration section by each host.</summary>
public sealed class DemoOptions
{
    public const string SectionName = "Demo";

    /// <summary>Wipes the database every night. Never turn this on for an instance with real data.</summary>
    public bool Enabled { get; init; }

    /// <summary>The password of every demo login. It is public: the sign-in page shows it.</summary>
    public string? Password { get; init; }

    /// <summary>When the demo is wiped and seeded again each day, in UTC.</summary>
    public TimeOnly ResetAtUtc { get; init; } = new(3, 0);

    /// <summary>Refuses settings that would leave the demo half working or open.</summary>
    /// <exception cref="InvalidOperationException">The settings cannot run a demo.</exception>
    public void Validate(bool registrationEnabled)
    {
        if (!Enabled)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(Password) || Password.Length < 12)
        {
            throw new InvalidOperationException(
                "Demo:Password must be at least 12 characters while Demo:Enabled is true.");
        }

        if (registrationEnabled)
        {
            throw new InvalidOperationException(
                "Turn registration off (Authentication:Session:RegistrationEnabled=false) while Demo:Enabled is "
                + "true: the demo is wiped every night, so no one should create an account there.");
        }
    }
}
