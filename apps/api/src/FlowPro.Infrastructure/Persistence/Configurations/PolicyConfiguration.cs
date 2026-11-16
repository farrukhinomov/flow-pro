using FlowPro.Domain.Policies;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlowPro.Infrastructure.Persistence.Configurations;

internal sealed class AttendancePolicyVersionConfiguration : IEntityTypeConfiguration<AttendancePolicyVersion>
{
    public void Configure(EntityTypeBuilder<AttendancePolicyVersion> builder)
    {
        builder.ToTable("attendance_policy_versions", DatabaseSchemas.Policies);
        builder.HasKey(policy => policy.Id);
        builder.HasAlternateKey(policy => new { policy.TenantId, policy.Id });
        builder.Property(policy => policy.PolicyId).HasMaxLength(80);
        builder.Property(policy => policy.ConfigJson).HasColumnType("jsonb");
        builder.HasIndex(policy => new
        {
            policy.TenantId,
            policy.PolicyId,
            policy.VersionNumber,
        }).IsUnique();
        builder.HasIndex(policy => new
        {
            policy.TenantId,
            policy.PolicyId,
            policy.IsCurrent,
        });

        // Every read resolves "which revision governs this instant" by scanning
        // backwards from the effective date, so that ordering is indexed.
        builder.HasIndex(policy => new
        {
            policy.TenantId,
            policy.PolicyId,
            policy.EffectiveFrom,
        });
        builder.HasOne<Domain.Tenancy.Tenant>()
            .WithMany()
            .HasForeignKey(policy => policy.TenantId);
        builder.HasOne<Domain.Identity.Membership>()
            .WithMany()
            .HasForeignKey(policy => new { policy.TenantId, Id = policy.PublishedByUserId })
            .HasPrincipalKey(user => new { user.TenantId, user.Id });
        builder.ConfigureTrackedEntity();
    }
}
