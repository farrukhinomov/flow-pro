using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Notifications;

namespace FlowPro.Api.Notifications;

internal static class NotificationWorkflowEndpoints
{
    public static IEndpointRouteBuilder MapNotificationWorkflowEndpoints(this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder group = endpoints
            .MapGroup("/api/v1/notification-center")
            .WithTags("Notifications");

        group.MapGet(
                "",
                (
                    string? cursor,
                    int? limit,
                    bool? unread,
                    string? type,
                    string? sourceId,
                    string? search,
                    IQueryHandler<ListNotificationsQuery, NotificationPage> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new ListNotificationsQuery(
                            limit is null && string.IsNullOrWhiteSpace(cursor)
                                ? null
                                : new CursorPageRequest(cursor, limit ?? CursorPageRequest.DefaultLimit),
                            unread is null
                            && string.IsNullOrWhiteSpace(type)
                            && string.IsNullOrWhiteSpace(sourceId)
                            && string.IsNullOrWhiteSpace(search)
                                ? null
                                : new NotificationFilter(unread, type, sourceId, search)),
                        cancellationToken))
            .RequireAuthorization(PermissionKeys.NotificationsWriteSelf);

        group.MapPost(
                "/{notificationId}/read",
                (
                    string notificationId,
                    ICommandHandler<MarkNotificationReadCommand, NotificationDto> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(new MarkNotificationReadCommand(notificationId), cancellationToken))
            .RequireAuthorization(PermissionKeys.NotificationsWriteSelf);

        group.MapPost(
                "/read-all",
                (
                    ICommandHandler<MarkAllNotificationsReadCommand, MarkAllNotificationsReadResult> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(new MarkAllNotificationsReadCommand(), cancellationToken))
            .RequireAuthorization(PermissionKeys.NotificationsWriteSelf);

        group.MapGet(
                "/preferences",
                (
                    IQueryHandler<GetNotificationPreferencesQuery, NotificationPreferencesDto> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(new GetNotificationPreferencesQuery(), cancellationToken))
            .RequireAuthorization(PermissionKeys.NotificationsWriteSelf);

        group.MapPut(
                "/preferences",
                (
                    SaveNotificationPreferencesCommand request,
                    ICommandHandler<SaveNotificationPreferencesCommand, NotificationPreferencesDto> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(request, cancellationToken))
            .RequireAuthorization(PermissionKeys.NotificationsWriteSelf);

        return endpoints;
    }
}
