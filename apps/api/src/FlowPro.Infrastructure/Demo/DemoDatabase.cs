using FlowPro.Application.Demo;
using FlowPro.Domain.Identity;
using FlowPro.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Infrastructure.Demo;

/// <remarks>
/// Truncating needs the rights of the tables' owner. The application connects as the owner today;
/// if that changes, the demo reset must use the migration connection.
/// </remarks>
internal sealed class DemoDatabase(FlowProDbContext dbContext) : IDemoDatabase
{
    private static readonly string[] Schemas =
    [
        DatabaseSchemas.Attendance,
        DatabaseSchemas.Audit,
        DatabaseSchemas.Identity,
        DatabaseSchemas.Infrastructure,
        DatabaseSchemas.Notifications,
        DatabaseSchemas.Onboarding,
        DatabaseSchemas.Organization,
        DatabaseSchemas.Policies,
        DatabaseSchemas.Tenancy,
        DatabaseSchemas.Timesheets,
    ];

    // Must see every workspace: under tenant isolation an unscoped query sees none, and the
    // safeguard would then wipe a database full of real workspaces.
    public Task<bool> HoldsOtherWorkspacesAsync(Guid demoTenantId, CancellationToken cancellationToken) =>
        dbContext.AcrossTenantsAsync(
            () => dbContext.Tenants.AnyAsync(tenant => tenant.Id != demoTenantId, cancellationToken),
            cancellationToken);

    public Task<bool> HasWorkspaceAsync(Guid tenantId, CancellationToken cancellationToken) =>
        dbContext.AcrossTenantsAsync(
            () => dbContext.Tenants.AnyAsync(tenant => tenant.Id == tenantId, cancellationToken),
            cancellationToken);

    // One statement over every FlowPro table except the migrations history, so new tables are
    // included without changing this code. PostgreSQL quotes the names (format %I).
    public async Task WipeAsync(CancellationToken cancellationToken)
    {
        List<string> tables = await dbContext.Database
            .SqlQuery<string>(
                $"""
                SELECT format('%I.%I', schemaname, tablename) AS "Value"
                FROM pg_tables
                WHERE schemaname = ANY ({Schemas}) AND tablename <> '__ef_migrations_history'
                ORDER BY 1
                """)
            .ToListAsync(cancellationToken);

        if (tables.Count == 0)
        {
            return;
        }

        string truncate = "TRUNCATE TABLE " + string.Join(", ", tables) + " RESTART IDENTITY CASCADE";
        await dbContext.Database.ExecuteSqlRawAsync(truncate, cancellationToken);
    }
}

internal sealed class DemoAccountWriter(
    FlowProDbContext dbContext,
    IPasswordHasher<Account> passwordHasher) : IDemoAccountWriter
{
    public void Add(DemoLogin login, string password)
    {
        ArgumentNullException.ThrowIfNull(login);

        Account account = new(login.Email, login.DisplayName, login.AccountId);
        account.SetEmailConfirmed(true);
        account.SetPasswordHash(passwordHasher.HashPassword(account, password));
        dbContext.Accounts.Add(account);
    }
}

internal sealed class DemoSampleWriter(FlowProDbContext dbContext) : IDemoSampleWriter
{
    public void Add(DemoSample sample)
    {
        ArgumentNullException.ThrowIfNull(sample);

        dbContext.Teams.AddRange(sample.Teams);
        dbContext.EmploymentContracts.AddRange(sample.Contracts);
        dbContext.TimeBookings.AddRange(sample.Bookings);
        dbContext.AttendanceStates.AddRange(sample.AttendanceStates);
        dbContext.ClientAggregates.AddRange(sample.Records);
        dbContext.OutboxMessages.AddRange(sample.SyncEvents);
    }
}
