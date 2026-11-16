using FlowPro.Application.Common;
using FlowPro.Domain.Identity;

namespace FlowPro.Application.Users;

public sealed record ListUsersQuery(
    CursorPageRequest? Page = null,
    UserDirectoryFilter? Filter = null) : IQuery<UserDirectoryPage>;

public sealed record UserDirectoryFilter(
    string? Search = null,
    UserStatus? Status = null,
    string? Role = null,
    string? Team = null);

public sealed record UpsertUserCommand(UserWorkflowRecord User)
    : ICommand<UserWorkflowResult>;

public sealed record InviteUserCommand(
    string Email,
    string Role,
    string? Note) : ICommand<UserWorkflowResult>;

public sealed record DeactivateUserCommand(
    string UserId,
    string? Reason) : ICommand<UserWorkflowResult>;

public sealed record ReactivateUserCommand(string UserId) : ICommand<UserWorkflowResult>;

public sealed record ResendInvitationCommand(string UserId) : ICommand<UserWorkflowResult>;

public sealed record UserDirectoryPage(
    IReadOnlyList<UserWorkflowRecord> Items,
    string? NextCursor = null);

public sealed record UserWorkflowResult(UserWorkflowRecord User);

public sealed record UserWorkflowRecord(
    string Id,
    string FirstName,
    string LastName,
    string Username,
    string Email,
    string PhoneNumber,
    UserStatus Status,
    string Role,
    string? RoleProfileId,
    string Team,
    string Manager,
    string WorkPattern,
    string VisibilityScope,
    DateTimeOffset? LastSeenAt,
    DateTimeOffset? NextReviewAt,
    DateTimeOffset? DeactivatedAt,
    string? DeactivatedBy,
    string? DeactivationReason,
    DateTimeOffset? RetentionUntil,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
