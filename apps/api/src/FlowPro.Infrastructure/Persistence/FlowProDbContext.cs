using System.Text;
using FlowPro.Domain.Attendance;
using FlowPro.Domain.Audit;
using FlowPro.Domain.Common;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Integration;
using FlowPro.Domain.Notifications;
using FlowPro.Domain.Onboarding;
using FlowPro.Domain.Organization;
using FlowPro.Domain.Policies;
using FlowPro.Domain.Sync;
using FlowPro.Domain.Tenancy;
using FlowPro.Domain.Timesheets;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Infrastructure.Persistence;

public sealed class FlowProDbContext(
    DbContextOptions<FlowProDbContext> options,
    TimeProvider timeProvider) : DbContext(options)
{
    public DbSet<Tenant> Tenants => Set<Tenant>();

    public DbSet<Membership> Users => Set<Membership>();

    public DbSet<Account> Accounts => Set<Account>();

    public DbSet<AccountSession> AccountSessions => Set<AccountSession>();

    public DbSet<AccountSecurityEvent> AccountSecurityEvents => Set<AccountSecurityEvent>();

    public DbSet<AccountToken> AccountTokens => Set<AccountToken>();

    public DbSet<AccountRecoveryCode> AccountRecoveryCodes => Set<AccountRecoveryCode>();

    public DbSet<MembershipInvitation> MembershipInvitations => Set<MembershipInvitation>();

    public DbSet<Role> Roles => Set<Role>();

    public DbSet<Permission> Permissions => Set<Permission>();

    public DbSet<UserRole> UserRoles => Set<UserRole>();

    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();

    public DbSet<UserPreferencesRecord> UserPreferences => Set<UserPreferencesRecord>();

    public DbSet<TenantOnboarding> TenantOnboardings => Set<TenantOnboarding>();

    public DbSet<Department> Departments => Set<Department>();

    public DbSet<Team> Teams => Set<Team>();

    public DbSet<Location> Locations => Set<Location>();

    public DbSet<Employee> Employees => Set<Employee>();

    public DbSet<EmploymentContract> EmploymentContracts => Set<EmploymentContract>();

    public DbSet<RoleProfile> RoleProfiles => Set<RoleProfile>();

    public DbSet<WorkPattern> WorkPatterns => Set<WorkPattern>();

    public DbSet<ManagerDelegation> ManagerDelegations => Set<ManagerDelegation>();

    public DbSet<AttendanceState> AttendanceStates => Set<AttendanceState>();

    public DbSet<TimeBooking> TimeBookings => Set<TimeBooking>();

    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();

    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    public DbSet<ClientAggregate> ClientAggregates => Set<ClientAggregate>();

    public DbSet<NotificationRecord> NotificationRecords => Set<NotificationRecord>();

    public DbSet<NotificationPreferencesRecord> NotificationPreferences => Set<NotificationPreferencesRecord>();

    public DbSet<MonthlyTimesheetSnapshot> MonthlyTimesheetSnapshots => Set<MonthlyTimesheetSnapshot>();

    public DbSet<AttendancePolicyVersion> AttendancePolicyVersions => Set<AttendancePolicyVersion>();

    public override int SaveChanges()
    {
        ApplyServerTimestamps();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyServerTimestamps();
        return base.SaveChangesAsync(cancellationToken);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(FlowProDbContext).Assembly);

        foreach (Microsoft.EntityFrameworkCore.Metadata.IMutableForeignKey foreignKey in
                 modelBuilder.Model.GetEntityTypes().SelectMany(entity => entity.GetForeignKeys()))
        {
            foreignKey.DeleteBehavior = DeleteBehavior.Restrict;
        }

        ApplySnakeCaseColumnNames(modelBuilder);
    }

    private void ApplyServerTimestamps()
    {
        DateTimeOffset now = timeProvider.GetUtcNow();

        foreach (Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry entry in ChangeTracker.Entries())
        {
            if (entry.Entity is not ITrackedEntity)
            {
                continue;
            }

            if (entry.State == EntityState.Added)
            {
                entry.Property(nameof(ITrackedEntity.CreatedAt)).CurrentValue = now;
                entry.Property(nameof(ITrackedEntity.UpdatedAt)).CurrentValue = now;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Property(nameof(ITrackedEntity.CreatedAt)).IsModified = false;
                entry.Property(nameof(ITrackedEntity.UpdatedAt)).CurrentValue = now;
            }
        }
    }

    private static void ApplySnakeCaseColumnNames(ModelBuilder modelBuilder)
    {
        foreach (Microsoft.EntityFrameworkCore.Metadata.IMutableEntityType entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (Microsoft.EntityFrameworkCore.Metadata.IMutableProperty property in entityType.GetProperties())
            {
                property.SetColumnName(ToSnakeCase(property.Name));
            }
        }
    }

    private static string ToSnakeCase(string value)
    {
        StringBuilder builder = new(value.Length + 8);

        for (int index = 0; index < value.Length; index++)
        {
            char character = value[index];

            if (char.IsUpper(character) && index > 0)
            {
                builder.Append('_');
            }

            builder.Append(char.ToLowerInvariant(character));
        }

        return builder.ToString();
    }
}
