using FlowPro.Domain.Audit;
using FlowPro.Domain.Integration;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlowPro.Infrastructure.Persistence.Configurations;

internal sealed class AuditEventConfiguration : IEntityTypeConfiguration<AuditEvent>
{
    public void Configure(EntityTypeBuilder<AuditEvent> builder)
    {
        builder.ToTable("audit_events", DatabaseSchemas.Audit);
        builder.HasKey(auditEvent => auditEvent.Id);
        builder.Property(auditEvent => auditEvent.Sequence).UseIdentityAlwaysColumn();
        builder.Property(auditEvent => auditEvent.Action).HasMaxLength(150);
        builder.Property(auditEvent => auditEvent.AggregateType).HasMaxLength(100);
        builder.Property(auditEvent => auditEvent.DetailsJson).HasColumnType("jsonb");
        builder.HasIndex(auditEvent => auditEvent.Sequence).IsUnique();
        builder.HasIndex(auditEvent => new { auditEvent.TenantId, auditEvent.OccurredAt });
        builder.HasIndex(auditEvent => new { auditEvent.TenantId, auditEvent.AggregateType, auditEvent.AggregateId });
    }
}

internal sealed class OutboxMessageConfiguration : IEntityTypeConfiguration<OutboxMessage>
{
    public void Configure(EntityTypeBuilder<OutboxMessage> builder)
    {
        builder.ToTable("outbox_messages", DatabaseSchemas.Infrastructure);
        builder.HasKey(message => message.Id);
        builder.Property(message => message.Sequence).UseIdentityAlwaysColumn();
        builder.Property(message => message.EventType).HasMaxLength(200);
        builder.Property(message => message.AggregateType).HasMaxLength(100);
        builder.Property(message => message.PayloadJson).HasColumnType("jsonb");
        builder.Property(message => message.LastError).HasMaxLength(2_000);
        builder.HasIndex(message => message.Sequence).IsUnique();
        builder.HasIndex(message => new { message.TenantId, message.Sequence });
        builder.HasIndex(message => new { message.ProcessedAt, message.Sequence });
    }
}
