using FlowPro.Application.Attendance;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Domain.Attendance;

namespace FlowPro.Api.Attendance;

internal static class AttendanceEndpoints
{
    public static IEndpointRouteBuilder MapAttendanceEndpoints(this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder group = endpoints
            .MapGroup("/api/v1/attendance")
            .WithTags("Attendance");

        group.MapGet(
                "/me/status",
                (
                    IQueryHandler<GetCurrentAttendanceStatusQuery, AttendanceStatus> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(new GetCurrentAttendanceStatusQuery(), cancellationToken))
            .RequireAuthorization(PermissionKeys.AttendanceViewSelf);

        group.MapGet(
                "/me/events",
                (
                    DateTimeOffset? from,
                    DateTimeOffset? to,
                    IQueryHandler<ListAttendanceEventsQuery, AttendanceEventPage> handler,
                    TimeProvider timeProvider,
                    CancellationToken cancellationToken) =>
                {
                    DateTimeOffset end = to ?? timeProvider.GetUtcNow();
                    DateTimeOffset start = from ?? end.AddDays(-31);
                    return handler.HandleAsync(
                        new ListAttendanceEventsQuery(start, end),
                        cancellationToken);
                })
            .RequireAuthorization(PermissionKeys.AttendanceViewSelf);

        MapCommand(group, "clock-in", TimeBookingType.ClockIn);
        MapCommand(group, "start-break", TimeBookingType.StartBreak);
        MapCommand(group, "resume-work", TimeBookingType.ResumeWork);
        MapCommand(group, "clock-out", TimeBookingType.ClockOut);

        group.MapPost(
                "/commands/manual-booking",
                (
                    ManualBookingRequest request,
                    HttpRequest httpRequest,
                    ICommandHandler<CreateManualTimeBookingCommand, AttendanceCommandResult> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new CreateManualTimeBookingCommand(
                            request.Type,
                            request.OccurredAt,
                            request.Location,
                            request.Reason,
                            ReadIdempotencyKey(httpRequest),
                            request.Latitude,
                            request.Longitude,
                            request.AccuracyMeters),
                        cancellationToken))
            .RequireAuthorization(PermissionKeys.AttendanceCorrectSelf);

        group.MapPost(
                "/bookings/{bookingId:guid}/corrections",
                (
                    Guid bookingId,
                    CorrectBookingRequest request,
                    HttpRequest httpRequest,
                    ICommandHandler<CorrectTimeBookingCommand, AttendanceCommandResult> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new CorrectTimeBookingCommand(
                            bookingId,
                            request.Type,
                            request.OccurredAt,
                            request.Location,
                            request.Reason,
                            ReadIdempotencyKey(httpRequest),
                            request.Latitude,
                            request.Longitude,
                            request.AccuracyMeters),
                        cancellationToken))
            .RequireAuthorization(PermissionKeys.AttendanceCorrectSelf);

        group.MapPost(
                "/bookings/{bookingId:guid}/void",
                (
                    Guid bookingId,
                    VoidBookingRequest request,
                    HttpRequest httpRequest,
                    ICommandHandler<VoidTimeBookingCommand, VoidTimeBookingResult> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new VoidTimeBookingCommand(
                            bookingId,
                            request.Reason,
                            ReadIdempotencyKey(httpRequest)),
                        cancellationToken))
            .RequireAuthorization(PermissionKeys.AttendanceCorrectSelf);

        return endpoints;
    }

    private static void MapCommand(RouteGroupBuilder group, string route, TimeBookingType type)
    {
        group.MapPost(
                $"/commands/{route}",
                async (
                    ClockCommandRequest? request,
                    HttpRequest httpRequest,
                    ICommandHandler<ExecuteAttendanceCommand, AttendanceCommandResult> handler,
                    CancellationToken cancellationToken) =>
                {
                    AttendanceCommandResult result = await handler.HandleAsync(
                        new ExecuteAttendanceCommand(
                            type,
                            type == TimeBookingType.ClockIn ? request?.Location : null,
                            ReadIdempotencyKey(httpRequest),
                            BookingSource.Web,
                            request?.DeviceId,
                            request?.DeviceSequence,
                            request?.Latitude,
                            request?.Longitude,
                            request?.AccuracyMeters),
                        cancellationToken);

                    return Results.Ok(result);
                })
            .RequireAuthorization(PermissionKeys.AttendanceClockSelf);
    }

    private static string ReadIdempotencyKey(HttpRequest request) =>
        request.Headers["Idempotency-Key"].ToString();
}

internal sealed record ClockCommandRequest(
    WorkLocation? Location,
    string? DeviceId,
    long? DeviceSequence,
    double? Latitude,
    double? Longitude,
    double? AccuracyMeters);

internal sealed record ManualBookingRequest(
    TimeBookingType Type,
    DateTimeOffset OccurredAt,
    WorkLocation? Location,
    double? Latitude,
    double? Longitude,
    double? AccuracyMeters,
    string Reason);

internal sealed record CorrectBookingRequest(
    TimeBookingType Type,
    DateTimeOffset OccurredAt,
    WorkLocation? Location,
    double? Latitude,
    double? Longitude,
    double? AccuracyMeters,
    string Reason);

internal sealed record VoidBookingRequest(string Reason);
