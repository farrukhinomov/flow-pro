using FlowPro.Domain.Identity;

namespace FlowPro.Application.Accounts;

/// <summary>
/// Issues invitation links and writes the invitation email.
/// </summary>
/// <remarks>
/// <see cref="PrepareAsync" /> runs inside the caller's transaction and only stores the
/// invitation; the caller enqueues the message with <see cref="Send" /> after committing, so a
/// link is never sent for an invitation that was rolled back.
/// </remarks>
public sealed class InvitationMailbox(
    IMembershipInvitationRepository invitations,
    IEmailQueue queue,
    AccountEmailOptions options,
    TimeProvider timeProvider)
{
    public async Task<EmailMessage?> PrepareAsync(
        Membership membership,
        string workspaceName,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(membership);

        if (options.AppBaseUrl is null || !membership.IsOpenForInvitation)
        {
            return null;
        }

        DateTimeOffset now = timeProvider.GetUtcNow();
        await invitations.RevokeOutstandingAsync(membership.TenantId, membership.Id, now, cancellationToken);

        string token = SessionToken.Generate();
        invitations.Add(new MembershipInvitation(
            membership.TenantId,
            membership.Id,
            membership.Email,
            SessionToken.Hash(token),
            now,
            options.InvitationLifetime));

        string baseUrl = options.AppBaseUrl.AbsoluteUri;
        string link = $"{baseUrl}{(baseUrl.EndsWith('/') ? string.Empty : "/")}accept-invitation"
            + $"{AccountMailbox.TokenFragmentPrefix}{token}";

        return new EmailMessage(
            membership.Email,
            $"You are invited to {workspaceName} on FlowPro",
            $"""
            Hello,

            you are invited to join {workspaceName} on FlowPro, where the team records working
            time, absences and requests. To accept, open this link:

            {link}

            If you have no FlowPro account yet, you will choose a password there. The link works
            once and expires in {(int)options.InvitationLifetime.TotalDays} days.
            If you did not expect this invitation, you can ignore this email.
            """);
    }

    public void Send(EmailMessage? message)
    {
        if (message is not null)
        {
            queue.Enqueue(message);
        }
    }
}
