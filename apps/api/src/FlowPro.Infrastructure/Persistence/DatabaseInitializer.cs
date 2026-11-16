using FlowPro.Application.Identity;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Organization;
using FlowPro.Domain.Tenancy;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FlowPro.Infrastructure.Persistence;

public sealed class DatabaseInitializer(
    FlowProDbContext dbContext,
    IPasswordHasher<Account> passwordHasher,
    IOptions<DatabaseOptions> options)
{
    private static readonly IReadOnlyList<DevelopmentPermissionDefinition> DevelopmentPermissions =
    [
        new(PermissionKeys.AbsencesWriteSelf, "Create and update own absence records.", null),
        new(PermissionKeys.ApprovalWorkflowsManage, "Manage tenant approval workflow rules.", null),
        new(PermissionKeys.AttachmentsWriteSelf, "Upload and update own attachments.", null),
        new(PermissionKeys.AuditViewFull, "View full tenant audit evidence.", null),
        new(PermissionKeys.AttendanceClockSelf, "Clock own attendance.", DevelopmentSeedIds.ClockPermissionId),
        new(PermissionKeys.AttendanceCorrectSelf, "Correct own attendance bookings.", DevelopmentSeedIds.CorrectPermissionId),
        new(PermissionKeys.AttendancePolicyManage, "Manage attendance policies and attendance types.", null),
        new(PermissionKeys.AttendanceViewSelf, "View own attendance.", DevelopmentSeedIds.ViewPermissionId),
        new(PermissionKeys.NotificationsManage, "Manage tenant notification records.", null),
        new(PermissionKeys.NotificationsWriteSelf, "Manage own notification preferences.", null),
        new(PermissionKeys.OrganizationManage, "Manage organization catalogs.", null),
        new(PermissionKeys.PayrollExportsManage, "Create and manage payroll exports.", null),
        new(PermissionKeys.RequestsApprove, "Approve and reject employee requests.", null),
        new(PermissionKeys.RequestsWriteSelf, "Create and update own requests.", null),
        new(PermissionKeys.SyncReadSelf, "Read own synchronization feed.", DevelopmentSeedIds.SyncPermissionId),
        new(PermissionKeys.SyncWriteSelf, "Write own synchronization changes.", DevelopmentSeedIds.SyncWritePermissionId),
        new(PermissionKeys.TimesheetsManage, "Manage employee timesheets.", null),
        new(PermissionKeys.TimesheetsWriteSelf, "Update own timesheet records.", null),
        new(PermissionKeys.UsersManage, "Manage users and access.", null),
    ];

    // Not in the cross-tenant scope: that opens a connection first, before EF can create a missing
    // database. A data migration that touches tenant rows sets the scope in its own SQL.
    public Task MigrateAsync(CancellationToken cancellationToken) =>
        dbContext.Database.MigrateAsync(cancellationToken);

    // The development seed acts on the whole database, not for a member.
    public Task SeedDevelopmentDataAsync(CancellationToken cancellationToken) =>
        dbContext.AcrossTenantsAsync(
            () => SeedDevelopmentDataAcrossTenantsAsync(cancellationToken),
            cancellationToken);

    private async Task SeedDevelopmentDataAcrossTenantsAsync(CancellationToken cancellationToken)
    {
        bool tenantExists = await dbContext.Tenants.AnyAsync(
                tenant => tenant.Id == DevelopmentSeedIds.TenantId,
                cancellationToken);

        if (tenantExists)
        {
            await EnsureDevelopmentPermissionsAsync(cancellationToken);
            await EnsureDevelopmentIdentityAsync(cancellationToken);
            await EnsureDevelopmentQaIdentitiesAsync(cancellationToken);
            await EnsureDevelopmentOrganizationCatalogAsync(cancellationToken);
            await EnsureDevelopmentAccountsAsync(cancellationToken);
            return;
        }

        Tenant tenant = new("flowpro-demo", "FlowPro Demo", DevelopmentSeedIds.TenantId);
        Membership user = new(
            tenant.Id,
            "usr-marta-lindgren",
            "founder@flowpro.local",
            "Marta Lindgren",
            DevelopmentSeedIds.UserId);
        Employee employee = new(
            tenant.Id,
            user.Id,
            "DEV-001",
            "Marta",
            "Lindgren",
            DevelopmentSeedIds.EmployeeId);
        Role role = new(tenant.Id, "superadmin", "Superadmin", DevelopmentSeedIds.EmployeeRoleId);
        Permission[] permissions = DevelopmentPermissions
            .Select(permission => new Permission(permission.Key, permission.Description, permission.Id))
            .ToArray();

        dbContext.AddRange(
            tenant,
            user,
            employee,
            role);
        dbContext.Permissions.AddRange(permissions);
        dbContext.UserRoles.Add(new UserRole(tenant.Id, user.Id, role.Id));
        dbContext.RolePermissions.AddRange(
            permissions.Select(permission => new RolePermission(tenant.Id, role.Id, permission.Id)));

        await dbContext.SaveChangesAsync(cancellationToken);
        await EnsureDevelopmentQaIdentitiesAsync(cancellationToken);
        await EnsureDevelopmentOrganizationCatalogAsync(cancellationToken);
        await EnsureDevelopmentAccountsAsync(cancellationToken);
    }

    /// <summary>
    /// Gives the seeded founder and worker memberships an account each, so the development stack
    /// signs in through the same session path as production.
    /// </summary>
    private async Task EnsureDevelopmentAccountsAsync(CancellationToken cancellationToken)
    {
        string? password = options.Value.DevelopmentAccountPassword;

        if (string.IsNullOrWhiteSpace(password))
        {
            return;
        }

        (Guid AccountId, Guid UserId)[] links =
        [
            (DevelopmentSeedIds.AccountId, DevelopmentSeedIds.UserId),
            (DevelopmentSeedIds.WorkerAccountId, DevelopmentSeedIds.WorkerUserId),
        ];

        foreach ((Guid accountId, Guid userId) in links)
        {
            Membership user = await dbContext.Users.SingleAsync(
                candidate => candidate.TenantId == DevelopmentSeedIds.TenantId && candidate.Id == userId,
                cancellationToken);
            Account? account = await dbContext.Accounts.SingleOrDefaultAsync(
                candidate => candidate.Id == accountId,
                cancellationToken);

            if (account is null)
            {
                account = new Account(user.Email, user.DisplayName, accountId);
                account.SetEmailConfirmed(true);
                dbContext.Accounts.Add(account);
            }

            // Reapplied on every start, so changing the configured password takes effect.
            if (account.PasswordHash is null
                || passwordHasher.VerifyHashedPassword(account, account.PasswordHash, password)
                    == PasswordVerificationResult.Failed)
            {
                account.SetPasswordHash(passwordHasher.HashPassword(account, password));
            }

            user.LinkAccount(accountId);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private Task<int> EnsureDevelopmentIdentityAsync(CancellationToken cancellationToken) =>
        dbContext.Database.ExecuteSqlRawAsync(
            """
            UPDATE identity.users
            SET
                external_subject = {6},
                email = {0},
                display_name = {1}
            WHERE tenant_id = {2} AND id = {3};

            UPDATE identity.roles
            SET
                key = {4},
                name = {5}
            WHERE tenant_id = {2} AND id = {7};
            """,
            [
                "founder@flowpro.local",
                "Marta Lindgren",
                DevelopmentSeedIds.TenantId,
                DevelopmentSeedIds.UserId,
                "superadmin",
                "Superadmin",
                "usr-marta-lindgren",
                DevelopmentSeedIds.EmployeeRoleId,
            ],
            cancellationToken);

    public Task ResetDevelopmentWorkflowDataAsync(CancellationToken cancellationToken) =>
        dbContext.Database.ExecuteSqlRawAsync(
            """
            TRUNCATE TABLE
                attendance.time_bookings,
                attendance.attendance_states,
                audit.audit_events,
                infrastructure.client_aggregates,
                infrastructure.outbox_messages
            RESTART IDENTITY CASCADE;
            """,
            cancellationToken);

    private async Task EnsureDevelopmentPermissionsAsync(CancellationToken cancellationToken)
    {
        string[] keys = DevelopmentPermissions.Select(permission => permission.Key).ToArray();
        Dictionary<string, Guid> existingPermissionIds = await dbContext.Permissions
            .Where(permission => keys.Contains(permission.Key))
            .ToDictionaryAsync(permission => permission.Key, permission => permission.Id, cancellationToken);

        foreach (DevelopmentPermissionDefinition permission in DevelopmentPermissions)
        {
            if (!existingPermissionIds.ContainsKey(permission.Key))
            {
                Permission created = new(permission.Key, permission.Description, permission.Id);
                dbContext.Permissions.Add(created);
                existingPermissionIds[permission.Key] = created.Id;
            }
        }

        HashSet<Guid> assignedPermissionIds = await dbContext.RolePermissions
            .Where(rolePermission => rolePermission.TenantId == DevelopmentSeedIds.TenantId
                && rolePermission.RoleId == DevelopmentSeedIds.EmployeeRoleId)
            .Select(rolePermission => rolePermission.PermissionId)
            .ToHashSetAsync(cancellationToken);

        foreach (Guid permissionId in existingPermissionIds.Values)
        {
            if (!assignedPermissionIds.Contains(permissionId))
            {
                dbContext.RolePermissions.Add(
                    new RolePermission(
                        DevelopmentSeedIds.TenantId,
                        DevelopmentSeedIds.EmployeeRoleId,
                        permissionId));
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureDevelopmentQaIdentitiesAsync(CancellationToken cancellationToken)
    {
        Membership? workerUser = await dbContext.Users.FirstOrDefaultAsync(
            user => user.TenantId == DevelopmentSeedIds.TenantId
                && user.Id == DevelopmentSeedIds.WorkerUserId,
            cancellationToken);
        if (workerUser is null)
        {
            dbContext.Users.Add(
                new Membership(
                    DevelopmentSeedIds.TenantId,
                    "usr-hannah-fischer",
                    "hannah.fischer@flowpro.test",
                    "Hannah Fischer",
                    DevelopmentSeedIds.WorkerUserId));
        }
        else
        {
            workerUser.UpdateProfile(
                "usr-hannah-fischer",
                "hannah.fischer@flowpro.test",
                "Hannah Fischer");
        }

        if (!await dbContext.Employees.AnyAsync(
                employee => employee.TenantId == DevelopmentSeedIds.TenantId
                    && employee.Id == DevelopmentSeedIds.WorkerEmployeeId,
                cancellationToken))
        {
            dbContext.Employees.Add(
                new Employee(
                    DevelopmentSeedIds.TenantId,
                    DevelopmentSeedIds.WorkerUserId,
                    "DEV-002",
                    "Hannah",
                    "Fischer",
                    DevelopmentSeedIds.WorkerEmployeeId));
        }

        Role? workerRole = await dbContext.Roles.FirstOrDefaultAsync(
            role => role.TenantId == DevelopmentSeedIds.TenantId
                && role.Id == DevelopmentSeedIds.WorkerRoleId,
            cancellationToken);
        if (workerRole is null)
        {
            dbContext.Roles.Add(
                new Role(
                    DevelopmentSeedIds.TenantId,
                    "employee",
                    "Mitarbeiter",
                    DevelopmentSeedIds.WorkerRoleId));
        }

        if (!await dbContext.UserRoles.AnyAsync(
                userRole => userRole.TenantId == DevelopmentSeedIds.TenantId
                    && userRole.UserId == DevelopmentSeedIds.WorkerUserId
                    && userRole.RoleId == DevelopmentSeedIds.WorkerRoleId,
                cancellationToken))
        {
            dbContext.UserRoles.Add(
                new UserRole(
                    DevelopmentSeedIds.TenantId,
                    DevelopmentSeedIds.WorkerUserId,
                    DevelopmentSeedIds.WorkerRoleId));
        }

        string[] workerPermissionKeys =
        [
            PermissionKeys.AbsencesWriteSelf,
            PermissionKeys.AttachmentsWriteSelf,
            PermissionKeys.AttendanceClockSelf,
            PermissionKeys.AttendanceCorrectSelf,
            PermissionKeys.AttendanceViewSelf,
            PermissionKeys.NotificationsWriteSelf,
            PermissionKeys.RequestsWriteSelf,
            PermissionKeys.SyncReadSelf,
            PermissionKeys.SyncWriteSelf,
            PermissionKeys.TimesheetsWriteSelf,
        ];
        Dictionary<string, Guid> workerPermissionIds = await dbContext.Permissions
            .Where(permission => workerPermissionKeys.Contains(permission.Key))
            .ToDictionaryAsync(permission => permission.Key, permission => permission.Id, cancellationToken);
        HashSet<Guid> assignedWorkerPermissionIds = await dbContext.RolePermissions
            .Where(rolePermission => rolePermission.TenantId == DevelopmentSeedIds.TenantId
                && rolePermission.RoleId == DevelopmentSeedIds.WorkerRoleId)
            .Select(rolePermission => rolePermission.PermissionId)
            .ToHashSetAsync(cancellationToken);

        foreach (Guid permissionId in workerPermissionIds.Values)
        {
            if (!assignedWorkerPermissionIds.Contains(permissionId))
            {
                dbContext.RolePermissions.Add(
                    new RolePermission(
                        DevelopmentSeedIds.TenantId,
                        DevelopmentSeedIds.WorkerRoleId,
                        permissionId));
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureDevelopmentOrganizationCatalogAsync(CancellationToken cancellationToken)
    {
        if (!await dbContext.Teams.AnyAsync(
                team => team.TenantId == DevelopmentSeedIds.TenantId && team.ExternalId == "team-management",
                cancellationToken))
        {
            dbContext.Teams.Add(
                new Team(
                    DevelopmentSeedIds.TenantId,
                    null,
                    "MANAGEMENT",
                    "Management",
                    externalId: "team-management",
                    managerUserId: DevelopmentSeedIds.UserId));
        }

        if (!await dbContext.RoleProfiles.AnyAsync(
                profile => profile.TenantId == DevelopmentSeedIds.TenantId,
                cancellationToken))
        {
            dbContext.RoleProfiles.AddRange(
                new RoleProfile(
                    DevelopmentSeedIds.TenantId,
                    "role-profile-superadmin",
                    "Superadmin",
                    "superadmin",
                    "Full platform administration.",
                    isActive: true),
                new RoleProfile(
                    DevelopmentSeedIds.TenantId,
                    "role-profile-admin",
                    "Admin",
                    "admin",
                    "Policy and integration administration.",
                    isActive: true),
                new RoleProfile(
                    DevelopmentSeedIds.TenantId,
                    "role-profile-hr",
                    "HR",
                    "hr",
                    "Request details and audit trail.",
                    isActive: true),
                new RoleProfile(
                    DevelopmentSeedIds.TenantId,
                    "role-profile-manager",
                    "Manager",
                    "manager",
                    "Team planning details.",
                    isActive: true),
                new RoleProfile(
                    DevelopmentSeedIds.TenantId,
                    "role-profile-employee",
                    "Mitarbeiter",
                    "employee",
                    "Availability only.",
                    isActive: true));
        }

        if (!await dbContext.WorkPatterns.AnyAsync(
                pattern => pattern.TenantId == DevelopmentSeedIds.TenantId,
                cancellationToken))
        {
            dbContext.WorkPatterns.AddRange(
                new WorkPattern(
                    DevelopmentSeedIds.TenantId,
                    "work-pattern-not-configured",
                    "Not configured",
                    0,
                    "Fallback until an employment contract is assigned.",
                    isActive: true),
                new WorkPattern(
                    DevelopmentSeedIds.TenantId,
                    "work-pattern-full-time-hybrid",
                    "Full-time · Hybrid",
                    2_400,
                    "Default 40-hour hybrid work week.",
                    isActive: true),
                new WorkPattern(
                    DevelopmentSeedIds.TenantId,
                    "work-pattern-part-time-mon-thu",
                    "Part-time · Mon-Thu",
                    1_440,
                    "Default 24-hour part-time work week.",
                    isActive: true));
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private sealed record DevelopmentPermissionDefinition(
        string Key,
        string Description,
        Guid? Id);
}
