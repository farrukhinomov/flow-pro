using FlowPro.Domain.Notifications;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlowPro.Infrastructure.Persistence.Configurations;

internal sealed class NotificationRecordConfiguration : IEntityTypeConfiguration<NotificationRecord>
{
    public void Configure(EntityTypeBuilder<NotificationRecord> builder)
    {
        builder.ToTable("notifications", DatabaseSchemas.Notifications);
        builder.HasKey(notification => notification.Id);
        builder.HasAlternateKey(notification => new { notification.TenantId, notification.Id });
        builder.Property(notification => notification.ExternalId).HasMaxLength(150);
        builder.Property(notification => notification.Type).HasMaxLength(120);
        builder.Property(notification => notification.Title).HasMaxLength(300);
        builder.Property(notification => notification.SourceId).HasMaxLength(150);
        builder.HasIndex(notification => new { notification.TenantId, notification.ExternalId }).IsUnique();
        builder.HasIndex(notification => new
        {
            notification.TenantId,
            notification.RecipientUserId,
            notification.CreatedAtUtc,
        });
        builder.HasOne<Domain.Tenancy.Tenant>()
            .WithMany()
            .HasForeignKey(notification => notification.TenantId);
        builder.HasOne<Domain.Identity.Membership>()
            .WithMany()
            .HasForeignKey(notification => new { notification.TenantId, Id = notification.RecipientUserId })
            .HasPrincipalKey(user => new { user.TenantId, user.Id });
        builder.ConfigureTrackedEntity();
    }
}

internal sealed class NotificationPreferencesRecordConfiguration : IEntityTypeConfiguration<NotificationPreferencesRecord>
{
    public void Configure(EntityTypeBuilder<NotificationPreferencesRecord> builder)
    {
        builder.ToTable("notification_preferences", DatabaseSchemas.Notifications);
        builder.HasKey(preferences => preferences.Id);
        builder.HasAlternateKey(preferences => new { preferences.TenantId, preferences.Id });
        builder.HasIndex(preferences => new { preferences.TenantId, preferences.OwnerUserId }).IsUnique();
        builder.HasOne<Domain.Tenancy.Tenant>()
            .WithMany()
            .HasForeignKey(preferences => preferences.TenantId);
        builder.HasOne<Domain.Identity.Membership>()
            .WithMany()
            .HasForeignKey(preferences => new { preferences.TenantId, Id = preferences.OwnerUserId })
            .HasPrincipalKey(user => new { user.TenantId, user.Id });
        builder.ConfigureTrackedEntity();
    }
}
