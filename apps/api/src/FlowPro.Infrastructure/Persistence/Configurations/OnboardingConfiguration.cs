using FlowPro.Domain.Onboarding;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlowPro.Infrastructure.Persistence.Configurations;

internal sealed class TenantOnboardingConfiguration : IEntityTypeConfiguration<TenantOnboarding>
{
    public void Configure(EntityTypeBuilder<TenantOnboarding> builder)
    {
        builder.ToTable("tenant_onboardings", DatabaseSchemas.Onboarding);
        builder.HasKey(onboarding => onboarding.Id);
        builder.HasAlternateKey(onboarding => new { onboarding.TenantId, onboarding.Id });
        builder.Property(onboarding => onboarding.Status).HasConversion<string>().HasMaxLength(30);
        builder.HasIndex(onboarding => onboarding.TenantId).IsUnique();
        builder.HasOne<Domain.Tenancy.Tenant>()
            .WithMany()
            .HasForeignKey(onboarding => onboarding.TenantId);
        builder.HasOne<Domain.Identity.Membership>()
            .WithMany()
            .HasForeignKey(onboarding => new { onboarding.TenantId, Id = onboarding.StartedByUserId })
            .HasPrincipalKey(user => new { user.TenantId, user.Id });
        builder.Ignore(onboarding => onboarding.CurrentStep);
        builder.ConfigureTrackedEntity();
    }
}
