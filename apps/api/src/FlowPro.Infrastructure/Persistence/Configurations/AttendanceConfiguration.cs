using FlowPro.Domain.Attendance;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Organization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlowPro.Infrastructure.Persistence.Configurations;

internal sealed class AttendanceStateConfiguration : IEntityTypeConfiguration<AttendanceState>
{
    public void Configure(EntityTypeBuilder<AttendanceState> builder)
    {
        builder.ToTable("attendance_states", DatabaseSchemas.Attendance);
        builder.HasKey(state => new { state.TenantId, state.EmployeeId });
        builder.Property(state => state.State).HasConversion<string>().HasMaxLength(30);
        builder.Property(state => state.CurrentLocation).HasConversion<string>().HasMaxLength(30);
        builder.HasOne<Employee>()
            .WithMany()
            .HasForeignKey(state => new { state.TenantId, Id = state.EmployeeId })
            .HasPrincipalKey(employee => new { employee.TenantId, employee.Id });
        builder.ConfigureTrackedEntity();
    }
}

internal sealed class TimeBookingConfiguration : IEntityTypeConfiguration<TimeBooking>
{
    public void Configure(EntityTypeBuilder<TimeBooking> builder)
    {
        builder.ToTable("time_bookings", DatabaseSchemas.Attendance);
        builder.HasKey(booking => booking.Id);
        builder.Property(booking => booking.Type).HasConversion<string>().HasMaxLength(30);
        builder.Property(booking => booking.Location).HasConversion<string>().HasMaxLength(30);
        builder.Property(booking => booking.Source).HasConversion<string>().HasMaxLength(30);
        builder.Property(booking => booking.ClientOperationId).HasMaxLength(150);
        builder.Property(booking => booking.CorrectionReason).HasMaxLength(500);
        builder.Property(booking => booking.DeviceId).HasMaxLength(150);
        builder.HasIndex(booking => new { booking.TenantId, booking.ClientOperationId }).IsUnique();
        builder.HasIndex(booking => new { booking.TenantId, booking.EmployeeId, booking.OccurredAt });
        builder.HasIndex(booking => new { booking.TenantId, booking.DeviceId, booking.DeviceSequence })
            .IsUnique()
            .HasFilter("device_id IS NOT NULL AND device_sequence IS NOT NULL");
        builder.HasOne<Employee>()
            .WithMany()
            .HasForeignKey(booking => new { booking.TenantId, Id = booking.EmployeeId })
            .HasPrincipalKey(employee => new { employee.TenantId, employee.Id });
        builder.HasOne<Membership>()
            .WithMany()
            .HasForeignKey(booking => new { booking.TenantId, Id = booking.VoidedByUserId })
            .HasPrincipalKey(user => new { user.TenantId, user.Id });
        builder.HasOne<TimeBooking>()
            .WithMany()
            .HasForeignKey(booking => new { booking.TenantId, Id = booking.SupersedesBookingId })
            .HasPrincipalKey(booking => new { booking.TenantId, booking.Id });
        builder.ConfigureTrackedEntity();
    }
}
