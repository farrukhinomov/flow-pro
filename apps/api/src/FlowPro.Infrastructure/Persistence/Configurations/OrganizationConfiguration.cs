using FlowPro.Domain.Organization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlowPro.Infrastructure.Persistence.Configurations;

internal sealed class DepartmentConfiguration : IEntityTypeConfiguration<Department>
{
    public void Configure(EntityTypeBuilder<Department> builder)
    {
        builder.ToTable("departments", DatabaseSchemas.Organization);
        builder.HasKey(department => department.Id);
        builder.HasAlternateKey(department => new { department.TenantId, department.Id });
        builder.Property(department => department.Code).HasMaxLength(50);
        builder.Property(department => department.Name).HasMaxLength(150);
        builder.HasIndex(department => new { department.TenantId, department.Code }).IsUnique();
        builder.HasOne<Domain.Tenancy.Tenant>().WithMany().HasForeignKey(department => department.TenantId);
        builder.ConfigureTrackedEntity();
    }
}

internal sealed class TeamConfiguration : IEntityTypeConfiguration<Team>
{
    public void Configure(EntityTypeBuilder<Team> builder)
    {
        builder.ToTable("teams", DatabaseSchemas.Organization);
        builder.HasKey(team => team.Id);
        builder.HasAlternateKey(team => new { team.TenantId, team.Id });
        builder.Property(team => team.ExternalId).HasMaxLength(120);
        builder.Property(team => team.Code).HasMaxLength(50);
        builder.Property(team => team.Name).HasMaxLength(150);
        builder.HasIndex(team => new { team.TenantId, team.ExternalId }).IsUnique();
        builder.HasIndex(team => new { team.TenantId, team.Code }).IsUnique();
        builder.HasOne<Domain.Tenancy.Tenant>().WithMany().HasForeignKey(team => team.TenantId);
        builder.HasOne<Department>()
            .WithMany()
            .HasForeignKey(team => new { team.TenantId, Id = team.DepartmentId })
            .HasPrincipalKey(department => new { department.TenantId, department.Id });
        builder.HasOne<Domain.Identity.Membership>()
            .WithMany()
            .HasForeignKey(team => new { team.TenantId, Id = team.ManagerUserId })
            .HasPrincipalKey(user => new { user.TenantId, user.Id });
        builder.ConfigureTrackedEntity();
    }
}

internal sealed class LocationConfiguration : IEntityTypeConfiguration<Location>
{
    public void Configure(EntityTypeBuilder<Location> builder)
    {
        builder.ToTable("locations", DatabaseSchemas.Organization);
        builder.HasKey(location => location.Id);
        builder.HasAlternateKey(location => new { location.TenantId, location.Id });
        builder.Property(location => location.Code).HasMaxLength(50);
        builder.Property(location => location.Name).HasMaxLength(150);
        builder.Property(location => location.TimeZoneId).HasMaxLength(100);
        builder.HasIndex(location => new { location.TenantId, location.Code }).IsUnique();
        builder.HasOne<Domain.Tenancy.Tenant>().WithMany().HasForeignKey(location => location.TenantId);
        builder.ConfigureTrackedEntity();
    }
}

internal sealed class EmployeeConfiguration : IEntityTypeConfiguration<Employee>
{
    public void Configure(EntityTypeBuilder<Employee> builder)
    {
        builder.ToTable("employees", DatabaseSchemas.Organization);
        builder.HasKey(employee => employee.Id);
        builder.HasAlternateKey(employee => new { employee.TenantId, employee.Id });
        builder.Property(employee => employee.PersonnelNumber).HasMaxLength(50);
        builder.Property(employee => employee.GivenName).HasMaxLength(100);
        builder.Property(employee => employee.FamilyName).HasMaxLength(100);
        builder.HasIndex(employee => new { employee.TenantId, employee.UserId }).IsUnique();
        builder.HasIndex(employee => new { employee.TenantId, employee.PersonnelNumber }).IsUnique();
        builder.HasOne<Domain.Identity.Membership>()
            .WithMany()
            .HasForeignKey(employee => new { employee.TenantId, Id = employee.UserId })
            .HasPrincipalKey(user => new { user.TenantId, user.Id });
        builder.HasOne<Team>()
            .WithMany()
            .HasForeignKey(employee => new { employee.TenantId, Id = employee.TeamId })
            .HasPrincipalKey(team => new { team.TenantId, team.Id });
        builder.HasOne<Department>()
            .WithMany()
            .HasForeignKey(employee => new { employee.TenantId, Id = employee.DepartmentId })
            .HasPrincipalKey(department => new { department.TenantId, department.Id });
        builder.HasOne<Location>()
            .WithMany()
            .HasForeignKey(employee => new { employee.TenantId, Id = employee.PrimaryLocationId })
            .HasPrincipalKey(location => new { location.TenantId, location.Id });
        builder.ConfigureTrackedEntity();
    }
}

internal sealed class EmploymentContractConfiguration : IEntityTypeConfiguration<EmploymentContract>
{
    public void Configure(EntityTypeBuilder<EmploymentContract> builder)
    {
        builder.ToTable("employment_contracts", DatabaseSchemas.Organization);
        builder.HasKey(contract => contract.Id);
        builder.Property(contract => contract.TimeZoneId).HasMaxLength(100);
        builder.HasIndex(contract => new { contract.TenantId, contract.EmployeeId, contract.EffectiveFrom }).IsUnique();
        builder.HasOne<Employee>()
            .WithMany()
            .HasForeignKey(contract => new { contract.TenantId, Id = contract.EmployeeId })
            .HasPrincipalKey(employee => new { employee.TenantId, employee.Id });
        builder.ConfigureTrackedEntity();
    }
}

internal sealed class RoleProfileConfiguration : IEntityTypeConfiguration<RoleProfile>
{
    public void Configure(EntityTypeBuilder<RoleProfile> builder)
    {
        builder.ToTable("role_profiles", DatabaseSchemas.Organization);
        builder.HasKey(profile => profile.Id);
        builder.HasAlternateKey(profile => new { profile.TenantId, profile.Id });
        builder.Property(profile => profile.ExternalId).HasMaxLength(120);
        builder.Property(profile => profile.Label).HasMaxLength(150);
        builder.Property(profile => profile.BaseRole).HasMaxLength(50);
        builder.Property(profile => profile.Description).HasMaxLength(500);
        builder.HasIndex(profile => new { profile.TenantId, profile.ExternalId }).IsUnique();
        builder.HasOne<Domain.Tenancy.Tenant>()
            .WithMany()
            .HasForeignKey(profile => profile.TenantId);
        builder.ConfigureTrackedEntity();
    }
}

internal sealed class WorkPatternConfiguration : IEntityTypeConfiguration<WorkPattern>
{
    public void Configure(EntityTypeBuilder<WorkPattern> builder)
    {
        builder.ToTable("work_patterns", DatabaseSchemas.Organization);
        builder.HasKey(pattern => pattern.Id);
        builder.HasAlternateKey(pattern => new { pattern.TenantId, pattern.Id });
        builder.Property(pattern => pattern.ExternalId).HasMaxLength(120);
        builder.Property(pattern => pattern.Label).HasMaxLength(150);
        builder.Property(pattern => pattern.Description).HasMaxLength(500);
        builder.HasIndex(pattern => new { pattern.TenantId, pattern.ExternalId }).IsUnique();
        builder.HasOne<Domain.Tenancy.Tenant>()
            .WithMany()
            .HasForeignKey(pattern => pattern.TenantId);
        builder.ConfigureTrackedEntity();
    }
}

internal sealed class ManagerDelegationConfiguration : IEntityTypeConfiguration<ManagerDelegation>
{
    public void Configure(EntityTypeBuilder<ManagerDelegation> builder)
    {
        builder.ToTable("manager_delegations", DatabaseSchemas.Organization);
        builder.HasKey(delegation => delegation.Id);
        builder.HasAlternateKey(delegation => new { delegation.TenantId, delegation.Id });
        builder.HasIndex(delegation => new
        {
            delegation.TenantId,
            delegation.ManagerUserId,
            delegation.TeamId,
        }).IsUnique();
        builder.HasOne<Domain.Tenancy.Tenant>()
            .WithMany()
            .HasForeignKey(delegation => delegation.TenantId);
        builder.HasOne<Domain.Identity.Membership>()
            .WithMany()
            .HasForeignKey(delegation => new { delegation.TenantId, Id = delegation.ManagerUserId })
            .HasPrincipalKey(user => new { user.TenantId, user.Id });
        builder.HasOne<Team>()
            .WithMany()
            .HasForeignKey(delegation => new { delegation.TenantId, Id = delegation.TeamId })
            .HasPrincipalKey(team => new { team.TenantId, team.Id });
        builder.ConfigureTrackedEntity();
    }
}
