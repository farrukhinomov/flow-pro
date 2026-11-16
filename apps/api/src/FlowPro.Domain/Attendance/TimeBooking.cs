using FlowPro.Domain.Common;

namespace FlowPro.Domain.Attendance;

public sealed class TimeBooking : ITrackedEntity
{
    private TimeBooking()
    {
    }

    private TimeBooking(
        Guid tenantId,
        Guid employeeId,
        TimeBookingType type,
        DateTimeOffset occurredAt,
        DateTimeOffset receivedAt,
        WorkLocation? location,
        BookingSource source,
        string clientOperationId,
        Guid? supersedesBookingId,
        string? correctionReason,
        string? deviceId,
        long? deviceSequence,
        double? latitude,
        double? longitude,
        double? accuracyMeters)
    {
        Id = Guid.CreateVersion7();
        TenantId = tenantId;
        EmployeeId = employeeId;
        Type = type;
        OccurredAt = occurredAt;
        ReceivedAt = receivedAt;
        Location = location;
        Source = source;
        ClientOperationId = Guard.Required(clientOperationId, nameof(clientOperationId), 150);
        SupersedesBookingId = supersedesBookingId;
        CorrectionReason = correctionReason is null
            ? null
            : Guard.Required(correctionReason, nameof(correctionReason), 500);
        DeviceId = deviceId is null ? null : Guard.Required(deviceId, nameof(deviceId), 150);
        DeviceSequence = deviceSequence;
        Latitude = latitude;
        Longitude = longitude;
        AccuracyMeters = accuracyMeters;
        Version = 1;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid EmployeeId { get; private set; }

    public TimeBookingType Type { get; private set; }

    public DateTimeOffset OccurredAt { get; private set; }

    public DateTimeOffset ReceivedAt { get; private set; }

    public WorkLocation? Location { get; private set; }

    public BookingSource Source { get; private set; }

    public string ClientOperationId { get; private set; } = string.Empty;

    public Guid? SupersedesBookingId { get; private set; }

    public string? CorrectionReason { get; private set; }

    public string? DeviceId { get; private set; }

    public long? DeviceSequence { get; private set; }

    public double? Latitude { get; private set; }

    public double? Longitude { get; private set; }

    public double? AccuracyMeters { get; private set; }

    public bool IsVoided { get; private set; }

    public DateTimeOffset? VoidedAt { get; private set; }

    public Guid? VoidedByUserId { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public long Version { get; private set; }

    public static TimeBooking Create(
        Guid tenantId,
        Guid employeeId,
        TimeBookingType type,
        DateTimeOffset occurredAt,
        DateTimeOffset receivedAt,
        WorkLocation? location,
        BookingSource source,
        string clientOperationId,
        Guid? supersedesBookingId = null,
        string? correctionReason = null,
        string? deviceId = null,
        long? deviceSequence = null,
        double? latitude = null,
        double? longitude = null,
        double? accuracyMeters = null) =>
        new(
            tenantId,
            employeeId,
            type,
            occurredAt,
            receivedAt,
            location,
            source,
            clientOperationId,
            supersedesBookingId,
            correctionReason,
            deviceId,
            deviceSequence,
            latitude,
            longitude,
            accuracyMeters);

    public void Void(Guid userId, DateTimeOffset voidedAt, string reason)
    {
        if (IsVoided)
        {
            return;
        }

        IsVoided = true;
        VoidedAt = voidedAt;
        VoidedByUserId = userId;
        CorrectionReason = Guard.Required(reason, nameof(reason), 500);
        Version++;
    }
}
