using FlowPro.Domain.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlowPro.Infrastructure.Persistence.Configurations;

internal sealed class TenantConfiguration : IEntityTypeConfiguration<Tenant>
{
    public void Configure(EntityTypeBuilder<Tenant> builder)
    {
        builder.ToTable("tenants", DatabaseSchemas.Tenancy);
        builder.HasKey(tenant => tenant.Id);
        builder.Property(tenant => tenant.Slug).HasMaxLength(80);
        builder.Property(tenant => tenant.Name).HasMaxLength(200);
        builder.Property(tenant => tenant.CountryCode).HasMaxLength(2);
        builder.Property(tenant => tenant.RegionCode).HasMaxLength(10);
        builder.HasIndex(tenant => tenant.Slug).IsUnique();
        builder.ConfigureTrackedEntity();
    }
}
