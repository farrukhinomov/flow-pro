using System.Text.Json;
using FlowPro.Application.Audit;
using FlowPro.Application.Common;
using FlowPro.Application.Integration;
using FlowPro.Application.Organization;
using FlowPro.Domain.Attendance;
using FlowPro.Domain.Audit;
using FlowPro.Domain.Integration;
using FlowPro.Domain.Organization;

namespace FlowPro.Application.Attendance;

public sealed class AttendanceCommandHandler(
    ICurrentRequestContext requestContext,
    IEmployeeDirectory employeeDirectory,
    IAttendanceRepository attendanceRepository,
    IAuditWriter auditWriter,
    IOutboxWriter outboxWriter,
    IUnitOfWork unitOfWork,
    TimeProvider timeProvider) :
    ICommandHandler<ExecuteAttendanceCommand, AttendanceCommandResult>,
    ICommandHandler<CreateManualTimeBookingCommand, AttendanceCommandResult>,
    ICommandHandler<CorrectTimeBookingCommand, AttendanceCommandResult>,
    ICommandHandler<VoidTimeBookingCommand, VoidTimeBookingResult>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<AttendanceCommandResult> HandleAsync(
        ExecuteAttendanceCommand command,
        CancellationToken cancellationToken)
    {
        ExecuteAttendanceCommand normalizedCommand = command with
        {
            IdempotencyKey = NormalizeIdempotencyKey(command.IdempotencyKey),
        };
        ValidateCommand(normalizedCommand);
        RequestIdentity identity = requestContext.GetRequiredIdentity();

        return await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                await attendanceRepository.AcquireExclusiveLockAsync(
                    $"operation:{identity.TenantId}:{normalizedCommand.IdempotencyKey}",
                    transactionCancellationToken);

                Employee employee = await GetCurrentEmployeeAsync(identity, transactionCancellationToken);
                await attendanceRepository.AcquireExclusiveLockAsync(
                    $"attendance:{identity.TenantId}:{employee.Id}",
                    transactionCancellationToken);

                TimeBooking? existing = await attendanceRepository.FindByClientOperationIdAsync(
                    identity.TenantId,
                    normalizedCommand.IdempotencyKey,
                    transactionCancellationToken);

                if (existing is not null)
                {
                    if (existing.EmployeeId != employee.Id || existing.Type != normalizedCommand.Type)
                    {
                        throw new FlowProConflictException(
                            "idempotency-key.reused",
                            "The idempotency key has already been used for another command.");
                    }

                    AttendanceState replayState = await GetRequiredStateAsync(
                        identity.TenantId,
                        employee.Id,
                        transactionCancellationToken);

                    return MapResult(existing, replayState, isReplay: true);
                }

                AttendanceState? existingState = await attendanceRepository.GetStateForUpdateAsync(
                    identity.TenantId,
                    employee.Id,
                    transactionCancellationToken);
                AttendanceState state = existingState ?? AttendanceState.Create(identity.TenantId, employee.Id);

                DateTimeOffset now = timeProvider.GetUtcNow();
                WorkLocation? location = normalizedCommand.Type == TimeBookingType.ClockIn
                    ? normalizedCommand.Location ?? WorkLocation.Office
                    : null;

                state.Apply(normalizedCommand.Type, now, location);

                TimeBooking booking = TimeBooking.Create(
                    identity.TenantId,
                    employee.Id,
                    normalizedCommand.Type,
                    now,
                    now,
                    location,
                    normalizedCommand.Source,
                    normalizedCommand.IdempotencyKey,
                    deviceId: normalizedCommand.DeviceId,
                    deviceSequence: normalizedCommand.DeviceSequence,
                    latitude: normalizedCommand.Latitude,
                    longitude: normalizedCommand.Longitude,
                    accuracyMeters: normalizedCommand.AccuracyMeters);

                if (existingState is null)
                {
                    attendanceRepository.Add(state);
                }

                attendanceRepository.Add(booking);

                string payload = JsonSerializer.Serialize(
                    new
                    {
                        booking.Id,
                        booking.EmployeeId,
                        Type = booking.Type.ToString(),
                        booking.OccurredAt,
                        Location = booking.Location?.ToString(),
                        Source = booking.Source.ToString(),
                        State = state.State.ToString(),
                        state.Version,
                    },
                    JsonOptions);

                auditWriter.Add(
                    new AuditEvent(
                        identity.TenantId,
                        identity.UserId,
                        $"attendance.{ToKebabCase(normalizedCommand.Type)}",
                        "time-booking",
                        booking.Id,
                        payload,
                        now));

                outboxWriter.Add(
                    new OutboxMessage(
                        identity.TenantId,
                        "attendance.booking-created.v1",
                        "time-booking",
                        booking.Id,
                        payload,
                        now));

                return MapResult(booking, state, isReplay: false);
            },
            cancellationToken);
    }

    public Task<AttendanceCommandResult> HandleAsync(
        CreateManualTimeBookingCommand command,
        CancellationToken cancellationToken)
    {
        CreateManualTimeBookingCommand normalizedCommand = command with
        {
            IdempotencyKey = NormalizeIdempotencyKey(command.IdempotencyKey),
            Reason = NormalizeReason(command.Reason),
        };
        ValidateMutation(
            normalizedCommand.IdempotencyKey,
            normalizedCommand.Reason,
            normalizedCommand.Latitude,
            normalizedCommand.Longitude,
            normalizedCommand.AccuracyMeters);

        return ExecuteManualMutationAsync(
            normalizedCommand.IdempotencyKey,
            normalizedCommand.Type,
            normalizedCommand.OccurredAt,
            normalizedCommand.Location,
            normalizedCommand.Latitude,
            normalizedCommand.Longitude,
            normalizedCommand.AccuracyMeters,
            normalizedCommand.Reason,
            supersedesBookingId: null,
            cancellationToken);
    }

    public Task<AttendanceCommandResult> HandleAsync(
        CorrectTimeBookingCommand command,
        CancellationToken cancellationToken)
    {
        CorrectTimeBookingCommand normalizedCommand = command with
        {
            IdempotencyKey = NormalizeIdempotencyKey(command.IdempotencyKey),
            Reason = NormalizeReason(command.Reason),
        };
        ValidateMutation(
            normalizedCommand.IdempotencyKey,
            normalizedCommand.Reason,
            normalizedCommand.Latitude,
            normalizedCommand.Longitude,
            normalizedCommand.AccuracyMeters);

        return ExecuteManualMutationAsync(
            normalizedCommand.IdempotencyKey,
            normalizedCommand.Type,
            normalizedCommand.OccurredAt,
            normalizedCommand.Location,
            normalizedCommand.Latitude,
            normalizedCommand.Longitude,
            normalizedCommand.AccuracyMeters,
            normalizedCommand.Reason,
            normalizedCommand.BookingId,
            cancellationToken);
    }

    public async Task<VoidTimeBookingResult> HandleAsync(
        VoidTimeBookingCommand command,
        CancellationToken cancellationToken)
    {
        VoidTimeBookingCommand normalizedCommand = command with
        {
            IdempotencyKey = NormalizeIdempotencyKey(command.IdempotencyKey),
            Reason = NormalizeReason(command.Reason),
        };
        ValidateMutation(normalizedCommand.IdempotencyKey, normalizedCommand.Reason);

        RequestIdentity identity = requestContext.GetRequiredIdentity();

        return await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                await attendanceRepository.AcquireExclusiveLockAsync(
                    $"operation:{identity.TenantId}:{normalizedCommand.IdempotencyKey}",
                    transactionCancellationToken);

                Employee employee = await GetCurrentEmployeeAsync(identity, transactionCancellationToken);
                await attendanceRepository.AcquireExclusiveLockAsync(
                    $"attendance:{identity.TenantId}:{employee.Id}",
                    transactionCancellationToken);

                TimeBooking booking = await GetRequiredOwnedBookingAsync(
                    identity,
                    employee,
                    normalizedCommand.BookingId,
                    transactionCancellationToken);
                AttendanceState state = await GetOrCreateStateAsync(
                    identity.TenantId,
                    employee.Id,
                    transactionCancellationToken);

                if (booking.IsVoided)
                {
                    return new VoidTimeBookingResult(MapBooking(booking), MapStatus(state), true);
                }

                DateTimeOffset now = timeProvider.GetUtcNow();
                booking.Void(identity.UserId, now, normalizedCommand.Reason);
                await RebuildStateAsync(identity.TenantId, employee.Id, state, transactionCancellationToken);

                WriteMutationEvidence(
                    identity,
                    booking,
                    state,
                    "attendance.booking-voided",
                    "attendance.booking-voided.v1",
                    normalizedCommand.Reason,
                    now);

                return new VoidTimeBookingResult(MapBooking(booking), MapStatus(state), false);
            },
            cancellationToken);
    }

    private async Task<AttendanceCommandResult> ExecuteManualMutationAsync(
        string idempotencyKey,
        TimeBookingType type,
        DateTimeOffset occurredAt,
        WorkLocation? requestedLocation,
        double? latitude,
        double? longitude,
        double? accuracyMeters,
        string reason,
        Guid? supersedesBookingId,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();

        return await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                await attendanceRepository.AcquireExclusiveLockAsync(
                    $"operation:{identity.TenantId}:{idempotencyKey}",
                    transactionCancellationToken);

                Employee employee = await GetCurrentEmployeeAsync(identity, transactionCancellationToken);
                await attendanceRepository.AcquireExclusiveLockAsync(
                    $"attendance:{identity.TenantId}:{employee.Id}",
                    transactionCancellationToken);

                TimeBooking? existing = await attendanceRepository.FindByClientOperationIdAsync(
                    identity.TenantId,
                    idempotencyKey,
                    transactionCancellationToken);

                if (existing is not null)
                {
                    if (existing.EmployeeId != employee.Id
                        || existing.Type != type
                        || existing.SupersedesBookingId != supersedesBookingId)
                    {
                        throw new FlowProConflictException(
                            "idempotency-key.reused",
                            "The idempotency key has already been used for another command.");
                    }

                    AttendanceState replayState = await GetRequiredStateAsync(
                        identity.TenantId,
                        employee.Id,
                        transactionCancellationToken);
                    return MapResult(existing, replayState, true);
                }

                DateTimeOffset now = timeProvider.GetUtcNow();
                ValidateManualOccurrence(occurredAt, now);

                TimeBooking? supersededBooking = null;
                if (supersedesBookingId is not null)
                {
                    supersededBooking = await GetRequiredOwnedBookingAsync(
                        identity,
                        employee,
                        supersedesBookingId.Value,
                        transactionCancellationToken);

                    if (supersededBooking.IsVoided)
                    {
                        throw new FlowProConflictException(
                            "attendance.booking-already-voided",
                            "The booking has already been voided or corrected.");
                    }

                    supersededBooking.Void(identity.UserId, now, reason);
                }

                WorkLocation? location = type == TimeBookingType.ClockIn
                    ? requestedLocation ?? WorkLocation.Office
                    : null;
                TimeBooking booking = TimeBooking.Create(
                    identity.TenantId,
                    employee.Id,
                    type,
                    occurredAt,
                    now,
                    location,
                    BookingSource.Manual,
                    idempotencyKey,
                    supersedesBookingId,
                    reason,
                    latitude: latitude,
                    longitude: longitude,
                    accuracyMeters: accuracyMeters);
                attendanceRepository.Add(booking);

                AttendanceState state = await GetOrCreateStateAsync(
                    identity.TenantId,
                    employee.Id,
                    transactionCancellationToken);
                await RebuildStateAsync(
                    identity.TenantId,
                    employee.Id,
                    state,
                    transactionCancellationToken,
                    booking);

                string action = supersededBooking is null
                    ? "attendance.manual-booking-created"
                    : "attendance.booking-corrected";
                string eventType = supersededBooking is null
                    ? "attendance.manual-booking-created.v1"
                    : "attendance.booking-corrected.v1";
                WriteMutationEvidence(identity, booking, state, action, eventType, reason, now);

                return MapResult(booking, state, false);
            },
            cancellationToken);
    }

    private async Task<Employee> GetCurrentEmployeeAsync(
        RequestIdentity identity,
        CancellationToken cancellationToken) =>
        await employeeDirectory.FindActiveByUserIdAsync(
            identity.TenantId,
            identity.UserId,
            cancellationToken)
        ?? throw new FlowProForbiddenException(
            "employee.not-active",
            "The current user is not linked to an active employee.");

    private async Task<AttendanceState> GetRequiredStateAsync(
        Guid tenantId,
        Guid employeeId,
        CancellationToken cancellationToken) =>
        await attendanceRepository.GetStateForUpdateAsync(tenantId, employeeId, cancellationToken)
        ?? throw new FlowProConflictException(
            "attendance.state-missing",
            "The existing booking does not have a corresponding attendance state.");

    private async Task<AttendanceState> GetOrCreateStateAsync(
        Guid tenantId,
        Guid employeeId,
        CancellationToken cancellationToken)
    {
        AttendanceState? state = await attendanceRepository.GetStateForUpdateAsync(
            tenantId,
            employeeId,
            cancellationToken);

        if (state is not null)
        {
            return state;
        }

        state = AttendanceState.Create(tenantId, employeeId);
        attendanceRepository.Add(state);
        return state;
    }

    private async Task<TimeBooking> GetRequiredOwnedBookingAsync(
        RequestIdentity identity,
        Employee employee,
        Guid bookingId,
        CancellationToken cancellationToken)
    {
        TimeBooking? booking = await attendanceRepository.FindByIdForUpdateAsync(
            identity.TenantId,
            bookingId,
            cancellationToken);

        if (booking is null || booking.EmployeeId != employee.Id)
        {
            throw new FlowProForbiddenException(
                "attendance.booking-not-accessible",
                "The booking does not exist or is not accessible.");
        }

        return booking;
    }

    private async Task RebuildStateAsync(
        Guid tenantId,
        Guid employeeId,
        AttendanceState state,
        CancellationToken cancellationToken,
        TimeBooking? pendingBooking = null)
    {
        IReadOnlyList<TimeBooking> activeBookings =
            await attendanceRepository.ListActiveBookingsForUpdateAsync(
                tenantId,
                employeeId,
                cancellationToken);
        IEnumerable<TimeBooking> bookings = pendingBooking is null
            ? activeBookings
            : activeBookings
                .Where(booking => booking.Id != pendingBooking.Id)
                .Append(pendingBooking);
        state.Rebuild(bookings);
    }

    private static void ValidateCommand(ExecuteAttendanceCommand command)
    {
        if (command.IdempotencyKey.Length == 0 || command.IdempotencyKey.Length > 150)
        {
            throw new FlowProValidationException(
                "idempotency-key.invalid",
                "A non-empty Idempotency-Key header of at most 150 characters is required.");
        }

        if (command.DeviceSequence < 0)
        {
            throw new FlowProValidationException(
                "attendance.device-sequence.invalid",
                "Device sequence cannot be negative.");
        }

        ValidateGeo(command.Latitude, command.Longitude, command.AccuracyMeters);
    }

    private static void ValidateMutation(
        string idempotencyKey,
        string reason,
        double? latitude = null,
        double? longitude = null,
        double? accuracyMeters = null)
    {
        if (idempotencyKey.Length == 0 || idempotencyKey.Length > 150)
        {
            throw new FlowProValidationException(
                "idempotency-key.invalid",
                "A non-empty Idempotency-Key header of at most 150 characters is required.");
        }

        if (reason.Length == 0 || reason.Length > 500)
        {
            throw new FlowProValidationException(
                "attendance.correction-reason.invalid",
                "A correction reason of at most 500 characters is required.");
        }

        ValidateGeo(latitude, longitude, accuracyMeters);
    }

    private static void ValidateManualOccurrence(DateTimeOffset occurredAt, DateTimeOffset now)
    {
        if (occurredAt > now.AddMinutes(5))
        {
            throw new FlowProValidationException(
                "attendance.occurred-at-in-future",
                "A manual booking cannot be more than five minutes in the future.");
        }
    }

    private static string NormalizeIdempotencyKey(string? value) => value?.Trim() ?? string.Empty;

    private static string NormalizeReason(string? value) => value?.Trim() ?? string.Empty;

    private static void ValidateGeo(double? latitude, double? longitude, double? accuracyMeters)
    {
        if (latitude.HasValue != longitude.HasValue)
        {
            throw new FlowProValidationException(
                "attendance.geo.incomplete",
                "Latitude and longitude must be supplied together.");
        }

        if (latitude is < -90 or > 90 || longitude is < -180 or > 180)
        {
            throw new FlowProValidationException(
                "attendance.geo.invalid",
                "The supplied geographic coordinate is invalid.");
        }

        if (accuracyMeters < 0)
        {
            throw new FlowProValidationException(
                "attendance.geo.accuracy-invalid",
                "Geographic accuracy cannot be negative.");
        }
    }

    private static AttendanceCommandResult MapResult(
        TimeBooking booking,
        AttendanceState state,
        bool isReplay) =>
        new(MapBooking(booking), MapStatus(state), isReplay);

    private static AttendanceStatus MapStatus(AttendanceState state) =>
        new(
            state.EmployeeId,
            state.State,
            state.CurrentLocation,
            state.StartedAt,
            state.BreakStartedAt,
            state.FinishedAt,
            state.LastEventAt,
            state.Version);

    private static TimeBookingRecord MapBooking(TimeBooking booking) =>
        new(
            booking.Id,
            booking.EmployeeId,
            booking.Type,
            booking.OccurredAt,
            booking.ReceivedAt,
            booking.Location,
            booking.Source,
            booking.SupersedesBookingId,
            booking.CorrectionReason,
            booking.DeviceId,
            booking.DeviceSequence,
            booking.Latitude,
            booking.Longitude,
            booking.AccuracyMeters,
            booking.IsVoided);

    private static string ToKebabCase(TimeBookingType type) =>
        type switch
        {
            TimeBookingType.ClockIn => "clock-in",
            TimeBookingType.StartBreak => "start-break",
            TimeBookingType.ResumeWork => "resume-work",
            TimeBookingType.ClockOut => "clock-out",
            _ => throw new ArgumentOutOfRangeException(nameof(type), type, null),
        };

    private void WriteMutationEvidence(
        RequestIdentity identity,
        TimeBooking booking,
        AttendanceState state,
        string action,
        string eventType,
        string reason,
        DateTimeOffset now)
    {
        string payload = JsonSerializer.Serialize(
            new
            {
                booking.Id,
                booking.EmployeeId,
                Type = booking.Type.ToString(),
                booking.OccurredAt,
                Location = booking.Location?.ToString(),
                Source = booking.Source.ToString(),
                booking.SupersedesBookingId,
                booking.Latitude,
                booking.Longitude,
                booking.AccuracyMeters,
                Reason = reason,
                booking.IsVoided,
                State = state.State.ToString(),
                state.Version,
            },
            JsonOptions);

        auditWriter.Add(
            new AuditEvent(
                identity.TenantId,
                identity.UserId,
                action,
                "time-booking",
                booking.Id,
                payload,
                now));
        outboxWriter.Add(
            new OutboxMessage(
                identity.TenantId,
                eventType,
                "time-booking",
                booking.Id,
                payload,
                now));
    }
}
