using FlowPro.Application.Common;
using FlowPro.Domain.Identity;

namespace FlowPro.Application.Accounts;

/// <summary>
/// Lets an invited person take up the membership an administrator prepared, either with the
/// account they already have or with a new one.
/// </summary>
/// <remarks>
/// The link was sent to the invited address, so following it proves control of that mailbox. An
/// existing account may only accept when it uses that address; anyone else must sign in with it.
/// Accepting runs in the invitation's workspace, the only one it changes.
/// </remarks>
public sealed class InvitationHandler(
    IMembershipInvitationRepository invitations,
    IInvitationTargets targets,
    IAccountCredentials credentials,
    IAccountSessionRepository sessions,
    IAccountSecurityLog securityLog,
    AccountSessionIssuer issuer,
    IProvisioningUnitOfWork unitOfWork,
    TimeProvider timeProvider) :
    IQueryHandler<PreviewInvitationQuery, InvitationPreview>,
    ICommandHandler<AcceptInvitationCommand, InvitationAccepted>,
    ICommandHandler<AcceptInvitationWithNewAccountCommand, IssuedSession>
{
    public const string OtherAddressCode = "account.invitation_other_address";

    public async Task<InvitationPreview> HandleAsync(
        PreviewInvitationQuery query,
        CancellationToken cancellationToken)
    {
        (MembershipInvitation invitation, InvitationTarget target) = await RequireOpenAsync(
            query.Token,
            cancellationToken);
        bool accountExists = await credentials.FindByEmailAsync(invitation.Email, cancellationToken) is not null;

        return new InvitationPreview(
            target.WorkspaceName,
            invitation.Email,
            target.Membership.DisplayName,
            accountExists);
    }

    public async Task<InvitationAccepted> HandleAsync(
        AcceptInvitationCommand command,
        CancellationToken cancellationToken)
    {
        (MembershipInvitation found, _) = await RequireOpenAsync(command.Token, cancellationToken);

        return await unitOfWork.ExecuteInTenantScopeAsync(
            found.TenantId,
            async transactionCancellationToken =>
            {
                (MembershipInvitation invitation, InvitationTarget target) = await RequireOpenAsync(
                    command.Token,
                    transactionCancellationToken);
                Account account = await credentials.FindByIdAsync(
                        command.Caller.AccountId,
                        transactionCancellationToken)
                    ?? throw new FlowProUnauthorizedException();

                if (!string.Equals(account.Email, invitation.Email, StringComparison.Ordinal))
                {
                    throw new FlowProValidationException(
                        OtherAddressCode,
                        "This invitation was sent to another email address. Sign in with that address to accept it.");
                }

                Accept(invitation, target, account, command.Client);

                // The person accepted to work there, so this session moves there too.
                AccountSession? session = await sessions.FindByIdAsync(
                    command.Caller.SessionId,
                    transactionCancellationToken);

                if (session is not null && session.AccountId == account.Id)
                {
                    session.SelectTenant(invitation.TenantId);
                }

                return new InvitationAccepted(invitation.TenantId, target.WorkspaceName);
            },
            cancellationToken);
    }

    public async Task<IssuedSession> HandleAsync(
        AcceptInvitationWithNewAccountCommand command,
        CancellationToken cancellationToken)
    {
        (MembershipInvitation found, _) = await RequireOpenAsync(command.Token, cancellationToken);

        // Registration may be turned off on this instance; an invitation is the way in that stays
        // open then.
        return await unitOfWork.ExecuteInTenantScopeAsync(
            found.TenantId,
            async transactionCancellationToken =>
            {
                (MembershipInvitation invitation, InvitationTarget target) = await RequireOpenAsync(
                    command.Token,
                    transactionCancellationToken);
                AccountRegistration registration = await credentials.RegisterAsync(
                    invitation.Email,
                    command.DisplayName,
                    command.Password,
                    transactionCancellationToken);

                if (registration.Account is not { } account)
                {
                    throw AccountSessionHandler.ToException(registration);
                }

                // The link reached this mailbox, which is what confirming the address proves.
                account.SetEmailConfirmed(true);
                Record(AccountSecurityEventTypes.Registered, account, command.Client);
                Accept(invitation, target, account, command.Client);

                return await issuer.IssueAsync(
                    account,
                    command.Client,
                    invitation.TenantId,
                    transactionCancellationToken);
            },
            cancellationToken);
    }

    private void Accept(
        MembershipInvitation invitation,
        InvitationTarget target,
        Account account,
        ClientContext client)
    {
        invitation.Accept(timeProvider.GetUtcNow());
        target.Membership.AcceptInvitation(account.Id, account.Email, account.DisplayName);
        Record(AccountSecurityEventTypes.InvitationAccepted, account, client);
    }

    private async Task<(MembershipInvitation Invitation, InvitationTarget Target)> RequireOpenAsync(
        string? token,
        CancellationToken cancellationToken)
    {
        if (!SessionToken.LooksValid(token))
        {
            throw InvalidInvitation();
        }

        MembershipInvitation? invitation = await invitations.FindByHashAsync(
            SessionToken.Hash(token!),
            cancellationToken);

        if (invitation is null || !invitation.IsUsable(timeProvider.GetUtcNow()))
        {
            throw InvalidInvitation();
        }

        InvitationTarget? target = await targets.FindAsync(
            invitation.TenantId,
            invitation.UserId,
            cancellationToken);

        // The membership was closed, or taken up some other way, since the link was sent.
        if (target is null || !target.Membership.IsOpenForInvitation)
        {
            throw InvalidInvitation();
        }

        return (invitation, target);
    }

    private static FlowProValidationException InvalidInvitation() =>
        new(
            AccountRecoveryHandler.InvalidTokenCode,
            "This invitation is invalid or has expired. Ask for a new one.");

    private void Record(string type, Account account, ClientContext client) =>
        securityLog.Record(new AccountSecurityEvent(
            type,
            account.Id,
            account.Email,
            client.IpAddress,
            client.UserAgent,
            timeProvider.GetUtcNow()));
}
