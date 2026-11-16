using FlowPro.Api.Authentication;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Users;
using FlowPro.Domain.Identity;

namespace FlowPro.Api.Users;

internal static class UserWorkflowEndpoints
{
    public static IEndpointRouteBuilder MapUserWorkflowEndpoints(this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder group = endpoints
            .MapGroup("/api/v1/directory/users")
            .WithTags("Users");

        group.MapGet(
                "",
                (
                    string? cursor,
                    int? limit,
                    string? search,
                    UserStatus? status,
                    string? role,
                    string? team,
                    IQueryHandler<ListUsersQuery, UserDirectoryPage> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new ListUsersQuery(
                            limit is null && string.IsNullOrWhiteSpace(cursor)
                                ? null
                                : new CursorPageRequest(cursor, limit ?? CursorPageRequest.DefaultLimit),
                            HasFilter(search, status, role, team)
                                ? new UserDirectoryFilter(search, status, role, team)
                                : null),
                        cancellationToken))
            // The handler decides: the whole directory with users.manage, the caller's own teams
            // with requests.approve.
            .RequireAuthorization();

        group.MapPut(
                "/{userId}",
                (
                    string userId,
                    UserWorkflowRecord request,
                    ICommandHandler<UpsertUserCommand, UserWorkflowResult> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new UpsertUserCommand(request with { Id = userId }),
                        cancellationToken))
            .RequireAuthorization(PermissionKeys.UsersManage);

        group.MapPost(
                "/invitations",
                (
                    InviteUserRequest request,
                    ICommandHandler<InviteUserCommand, UserWorkflowResult> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new InviteUserCommand(request.Email, request.Role, request.Note),
                        cancellationToken))
            .RequireAuthorization(PermissionKeys.UsersManage);

        group.MapPost(
                "/{userId}/deactivate",
                (
                    string userId,
                    DeactivateUserRequest request,
                    ICommandHandler<DeactivateUserCommand, UserWorkflowResult> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new DeactivateUserCommand(userId, request.Reason),
                        cancellationToken))
            .RequireAuthorization(PermissionKeys.UsersManage);

        group.MapPost(
                "/{userId}/invitation",
                (
                    string userId,
                    ICommandHandler<ResendInvitationCommand, UserWorkflowResult> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(new ResendInvitationCommand(userId), cancellationToken))
            .RequireAuthorization(PermissionKeys.UsersManage)
            .RequireRateLimiting(RateLimitPolicies.AccountEmail);

        group.MapPost(
                "/{userId}/reactivate",
                (
                    string userId,
                    ICommandHandler<ReactivateUserCommand, UserWorkflowResult> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(new ReactivateUserCommand(userId), cancellationToken))
            .RequireAuthorization(PermissionKeys.UsersManage);

        return endpoints;
    }

    private sealed record InviteUserRequest(string Email, string Role, string? Note);

    private sealed record DeactivateUserRequest(string? Reason);

    private static bool HasFilter(
        string? search,
        UserStatus? status,
        string? role,
        string? team) =>
        !string.IsNullOrWhiteSpace(search)
        || status is not null
        || !string.IsNullOrWhiteSpace(role)
        || !string.IsNullOrWhiteSpace(team);
}
