using FlowPro.Application.Common;
using FlowPro.Domain.Identity;

namespace FlowPro.Application.Accounts;

/// <summary>What the invitation link leads to, shown before the person accepts.</summary>
public sealed record PreviewInvitationQuery(string Token) : IQuery<InvitationPreview>;

/// <param name="AccountExists">
/// Whether the invited address already has an account, so the page can ask the person to sign in
/// instead of creating one. Only the holder of the link, sent to that address, learns this.
/// </param>
public sealed record InvitationPreview(
    string WorkspaceName,
    string Email,
    string DisplayName,
    bool AccountExists);

/// <summary>Takes the membership up with the signed-in account, whose address must match.</summary>
public sealed record AcceptInvitationCommand(string Token, AccountCaller Caller, ClientContext Client)
    : ICommand<InvitationAccepted>;

/// <summary>Creates the invited person's account, takes the membership up and signs them in.</summary>
public sealed record AcceptInvitationWithNewAccountCommand(
    string Token,
    string DisplayName,
    string Password,
    ClientContext Client) : ICommand<IssuedSession>;

public sealed record InvitationAccepted(Guid TenantId, string WorkspaceName);

/// <summary>A membership an invitation can be sent for, with the name of its workspace.</summary>
public sealed record InvitationTarget(Membership Membership, string WorkspaceName);

public interface IMembershipInvitationRepository
{
    void Add(MembershipInvitation invitation);

    Task<MembershipInvitation?> FindByHashAsync(string tokenHash, CancellationToken cancellationToken);

    /// <summary>Revokes the membership's unused invitations, so only the newest link works.</summary>
    Task RevokeOutstandingAsync(
        Guid tenantId,
        Guid userId,
        DateTimeOffset now,
        CancellationToken cancellationToken);
}

public interface IInvitationTargets
{
    /// <summary>The membership and its workspace, across workspaces; null when either is gone.</summary>
    Task<InvitationTarget?> FindAsync(Guid tenantId, Guid userId, CancellationToken cancellationToken);

    /// <summary>The workspace's name for the invitation email; null when it does not exist.</summary>
    Task<string?> FindWorkspaceNameAsync(Guid tenantId, CancellationToken cancellationToken);
}
