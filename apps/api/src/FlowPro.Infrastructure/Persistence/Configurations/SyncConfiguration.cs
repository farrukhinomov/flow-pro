using FlowPro.Domain.Sync;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlowPro.Infrastructure.Persistence.Configurations;

internal sealed class ClientAggregateConfiguration : IEntityTypeConfiguration<ClientAggregate>
{
    public void Configure(EntityTypeBuilder<ClientAggregate> builder)
    {
        builder.ToTable("client_aggregates", DatabaseSchemas.Infrastructure);
        builder.HasKey(aggregate => new { aggregate.TenantId, aggregate.AggregateType, aggregate.AggregateId });
        builder.Property(aggregate => aggregate.AggregateType).HasMaxLength(100);
        builder.Property(aggregate => aggregate.AggregateId).HasMaxLength(150);
        builder.Property(aggregate => aggregate.PayloadJson).HasColumnType("jsonb");
        builder.Property(aggregate => aggregate.LastClientOperationId).HasMaxLength(150);
        builder.HasIndex(aggregate => new { aggregate.TenantId, aggregate.AggregateType, aggregate.IsDeleted });
        builder.HasIndex(aggregate => new { aggregate.TenantId, aggregate.OwnerUserId, aggregate.UpdatedAt });
        builder.HasOne<Domain.Tenancy.Tenant>().WithMany().HasForeignKey(aggregate => aggregate.TenantId);
        builder.ConfigureTrackedEntity();
    }
}
