using FlowPro.Domain.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlowPro.Infrastructure.Persistence.Configurations;

internal sealed class MembershipConfiguration : IEntityTypeConfiguration<Membership>
{
    public void Configure(EntityTypeBuilder<Membership> builder)
    {
        builder.ToTable("users", DatabaseSchemas.Identity);
        builder.HasKey(user => user.Id);
        builder.HasAlternateKey(user => new { user.TenantId, user.Id });
        builder.Property(user => user.ExternalSubject).HasMaxLength(200);
        builder.Property(user => user.Email).HasMaxLength(320);
        builder.Property(user => user.DisplayName).HasMaxLength(200);
        builder.Property(user => user.Status).HasConversion<string>().HasMaxLength(30);
        builder.HasIndex(user => new { user.TenantId, user.ExternalSubject }).IsUnique();
        builder.HasIndex(user => new { user.TenantId, user.Email }).IsUnique();

        // One membership per account and tenant. Also the lookup path for every signed-in request.
        builder.HasIndex(user => new { user.AccountId, user.TenantId })
            .IsUnique()
            .HasFilter("account_id IS NOT NULL");
        builder.HasOne<Domain.Tenancy.Tenant>()
            .WithMany()
            .HasForeignKey(user => user.TenantId);
        builder.HasOne<Account>()
            .WithMany()
            .HasForeignKey(user => user.AccountId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.ConfigureTrackedEntity();
    }
}

internal sealed class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> builder)
    {
        builder.ToTable("roles", DatabaseSchemas.Identity);
        builder.HasKey(role => role.Id);
        builder.HasAlternateKey(role => new { role.TenantId, role.Id });
        builder.Property(role => role.Key).HasMaxLength(100);
        builder.Property(role => role.Name).HasMaxLength(150);
        builder.HasIndex(role => new { role.TenantId, role.Key }).IsUnique();
        builder.HasOne<Domain.Tenancy.Tenant>()
            .WithMany()
            .HasForeignKey(role => role.TenantId);
        builder.ConfigureTrackedEntity();
    }
}

internal sealed class PermissionConfiguration : IEntityTypeConfiguration<Permission>
{
    public void Configure(EntityTypeBuilder<Permission> builder)
    {
        builder.ToTable("permissions", DatabaseSchemas.Identity);
        builder.HasKey(permission => permission.Id);
        builder.Property(permission => permission.Key).HasMaxLength(150);
        builder.Property(permission => permission.Description).HasMaxLength(300);
        builder.HasIndex(permission => permission.Key).IsUnique();
        builder.ConfigureTrackedEntity();
    }
}

internal sealed class UserRoleConfiguration : IEntityTypeConfiguration<UserRole>
{
    public void Configure(EntityTypeBuilder<UserRole> builder)
    {
        builder.ToTable("user_roles", DatabaseSchemas.Identity);
        builder.HasKey(userRole => new { userRole.TenantId, userRole.UserId, userRole.RoleId });
        builder.HasOne<Membership>()
            .WithMany()
            .HasForeignKey(userRole => new { userRole.TenantId, Id = userRole.UserId })
            .HasPrincipalKey(user => new { user.TenantId, user.Id });
        builder.HasOne<Role>()
            .WithMany()
            .HasForeignKey(userRole => new { userRole.TenantId, Id = userRole.RoleId })
            .HasPrincipalKey(role => new { role.TenantId, role.Id });
    }
}

internal sealed class RolePermissionConfiguration : IEntityTypeConfiguration<RolePermission>
{
    public void Configure(EntityTypeBuilder<RolePermission> builder)
    {
        builder.ToTable("role_permissions", DatabaseSchemas.Identity);
        builder.HasKey(rolePermission => new
        {
            rolePermission.TenantId,
            rolePermission.RoleId,
            rolePermission.PermissionId,
        });
        builder.HasOne<Role>()
            .WithMany()
            .HasForeignKey(rolePermission => new { rolePermission.TenantId, Id = rolePermission.RoleId })
            .HasPrincipalKey(role => new { role.TenantId, role.Id });
        builder.HasOne<Permission>()
            .WithMany()
            .HasForeignKey(rolePermission => rolePermission.PermissionId);
    }
}

internal sealed class UserPreferencesRecordConfiguration : IEntityTypeConfiguration<UserPreferencesRecord>
{
    public void Configure(EntityTypeBuilder<UserPreferencesRecord> builder)
    {
        builder.ToTable("user_preferences", DatabaseSchemas.Identity);
        builder.HasKey(preferences => preferences.Id);
        builder.HasAlternateKey(preferences => new { preferences.TenantId, preferences.Id });

        // One row per user: the handler upserts on this pair, and a duplicate
        // would make which preferences win depend on insertion order.
        builder.HasIndex(preferences => new { preferences.TenantId, preferences.OwnerUserId }).IsUnique();

        builder.Property(preferences => preferences.Locale).HasMaxLength(16).IsRequired();
        builder.Property(preferences => preferences.TimeZoneId).HasMaxLength(64).IsRequired();
        builder.Property(preferences => preferences.WeekStart).HasMaxLength(16).IsRequired();
        builder.Property(preferences => preferences.DefaultWorkLocation).HasMaxLength(32).IsRequired();

        builder.HasOne<Domain.Tenancy.Tenant>()
            .WithMany()
            .HasForeignKey(preferences => preferences.TenantId);
        builder.HasOne<Membership>()
            .WithMany()
            .HasForeignKey(preferences => new { preferences.TenantId, Id = preferences.OwnerUserId })
            .HasPrincipalKey(user => new { user.TenantId, user.Id });
        builder.ConfigureTrackedEntity();
    }
}
