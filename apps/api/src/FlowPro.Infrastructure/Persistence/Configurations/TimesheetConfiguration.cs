using FlowPro.Domain.Timesheets;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlowPro.Infrastructure.Persistence.Configurations;

internal sealed class MonthlyTimesheetSnapshotConfiguration : IEntityTypeConfiguration<MonthlyTimesheetSnapshot>
{
    public void Configure(EntityTypeBuilder<MonthlyTimesheetSnapshot> builder)
    {
        builder.ToTable("monthly_snapshots", DatabaseSchemas.Timesheets);
        builder.HasKey(snapshot => snapshot.Id);
        builder.HasAlternateKey(snapshot => new { snapshot.TenantId, snapshot.Id });
        builder.Property(snapshot => snapshot.EmployeeExternalId).HasMaxLength(200);
        builder.Property(snapshot => snapshot.PeriodMonth).HasMaxLength(7);
        builder.Property(snapshot => snapshot.Status).HasMaxLength(20);
        builder.Property(snapshot => snapshot.SignedByExternalId).HasMaxLength(200);
        builder.Property(snapshot => snapshot.SignedByName).HasMaxLength(200);
        builder.Property(snapshot => snapshot.Note).HasMaxLength(1_000);
        builder.Property(snapshot => snapshot.SnapshotJson).HasColumnType("jsonb");
        builder.Property(snapshot => snapshot.SnapshotHash).HasMaxLength(128);
        builder.HasIndex(snapshot => new
        {
            snapshot.TenantId,
            snapshot.EmployeeExternalId,
            snapshot.PeriodMonth,
        }).IsUnique();
        builder.HasOne<Domain.Tenancy.Tenant>()
            .WithMany()
            .HasForeignKey(snapshot => snapshot.TenantId);
        builder.HasOne<Domain.Identity.Membership>()
            .WithMany()
            .HasForeignKey(snapshot => new { snapshot.TenantId, Id = snapshot.EmployeeUserId })
            .HasPrincipalKey(user => new { user.TenantId, user.Id });
        builder.HasOne<Domain.Identity.Membership>()
            .WithMany()
            .HasForeignKey(snapshot => new { snapshot.TenantId, Id = snapshot.SignedByUserId })
            .HasPrincipalKey(user => new { user.TenantId, user.Id });
        builder.ConfigureTrackedEntity();
    }
}
