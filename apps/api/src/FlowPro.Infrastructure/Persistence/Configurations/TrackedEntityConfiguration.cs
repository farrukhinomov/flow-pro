using FlowPro.Domain.Common;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlowPro.Infrastructure.Persistence.Configurations;

internal static class TrackedEntityConfiguration
{
    public static void ConfigureTrackedEntity<TEntity>(this EntityTypeBuilder<TEntity> builder)
        where TEntity : class, ITrackedEntity
    {
        builder.Property(entity => entity.CreatedAt).IsRequired();
        builder.Property(entity => entity.UpdatedAt).IsRequired();
        builder.Property(entity => entity.Version).IsConcurrencyToken();
    }
}
