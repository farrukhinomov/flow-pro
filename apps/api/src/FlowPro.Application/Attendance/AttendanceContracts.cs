using FlowPro.Application.Common;
using FlowPro.Domain.Attendance;

namespace FlowPro.Application.Attendance;

public sealed record ExecuteAttendanceCommand(
    TimeBookingType Type,
    WorkLocation? Location,
    string IdempotencyKey,
    BookingSource Source = BookingSource.Web,
    string? DeviceId = null,
    long? DeviceSequence = null,
    double? Latitude = null,
    double? Longitude = null,
    double? AccuracyMeters = null) : ICommand<AttendanceCommandResult>;

public sealed record CreateManualTimeBookingCommand(
    TimeBookingType Type,
    DateTimeOffset OccurredAt,
    WorkLocation? Location,
    string Reason,
    string IdempotencyKey,
    double? Latitude = null,
    double? Longitude = null,
    double? AccuracyMeters = null) : ICommand<AttendanceCommandResult>;

public sealed record CorrectTimeBookingCommand(
    Guid BookingId,
    TimeBookingType Type,
    DateTimeOffset OccurredAt,
    WorkLocation? Location,
    string Reason,
    string IdempotencyKey,
    double? Latitude = null,
    double? Longitude = null,
    double? AccuracyMeters = null) : ICommand<AttendanceCommandResult>;

public sealed record VoidTimeBookingCommand(
    Guid BookingId,
    string Reason,
    string IdempotencyKey) : ICommand<VoidTimeBookingResult>;

public sealed record GetCurrentAttendanceStatusQuery : IQuery<AttendanceStatus>;

public sealed record ListAttendanceEventsQuery(
    DateTimeOffset FromInclusive,
    DateTimeOffset ToExclusive) : IQuery<AttendanceEventPage>;

public sealed record AttendanceStatus(
    Guid EmployeeId,
    WorkState State,
    WorkLocation? Location,
    DateTimeOffset? StartedAt,
    DateTimeOffset? BreakStartedAt,
    DateTimeOffset? FinishedAt,
    DateTimeOffset? LastEventAt,
    long Version);

public sealed record TimeBookingRecord(
    Guid Id,
    Guid EmployeeId,
    TimeBookingType Type,
    DateTimeOffset OccurredAt,
    DateTimeOffset ReceivedAt,
    WorkLocation? Location,
    BookingSource Source,
    Guid? SupersedesBookingId,
    string? CorrectionReason,
    string? DeviceId,
    long? DeviceSequence,
    double? Latitude,
    double? Longitude,
    double? AccuracyMeters,
    bool IsVoided);

public sealed record AttendanceCommandResult(
    TimeBookingRecord Booking,
    AttendanceStatus Status,
    bool IsReplay);

public sealed record VoidTimeBookingResult(
    TimeBookingRecord Booking,
    AttendanceStatus Status,
    bool IsReplay);

public sealed record AttendanceEventPage(IReadOnlyList<TimeBookingRecord> Items);
