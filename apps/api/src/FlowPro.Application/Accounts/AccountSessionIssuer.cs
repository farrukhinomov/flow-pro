using FlowPro.Domain.Identity;

namespace FlowPro.Application.Accounts;

/// <summary>Starts a new session for an account. Runs inside the caller's transaction.</summary>
public sealed class AccountSessionIssuer(
    IAccountSessionRepository sessions,
    IAccountWorkspaces workspaces,
    AccountSessionOptions options,
    TimeProvider timeProvider)
{
    /// <param name="tenantId">
    /// The workspace to start in. Without one, the session starts in the workspace the account
    /// used last, or the one it joined first, so a person in several workspaces lands somewhere
    /// definite instead of nowhere.
    /// </param>
    public async Task<IssuedSession> IssueAsync(
        Account account,
        ClientContext client,
        Guid? tenantId,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(account);
        ArgumentNullException.ThrowIfNull(client);

        string token = SessionToken.Generate();
        AccountSession session = new(
            account.Id,
            SessionToken.Hash(token),
            timeProvider.GetUtcNow(),
            options.AbsoluteLifetime,
            client.UserAgent,
            client.IpAddress);

        if (tenantId is null)
        {
            // Asked before the new session exists, so "last chosen" means an earlier session.
            Guid? lastChosen = await workspaces.FindLastChosenAsync(account.Id, cancellationToken);
            tenantId = WorkspaceSelection.ChooseDefault(
                await workspaces.ListAsync(account.Id, cancellationToken),
                lastChosen);
        }

        session.SelectTenant(tenantId);
        sessions.Add(session);

        return new IssuedSession(
            token,
            session.ExpiresAt,
            account.Id,
            account.Email,
            account.DisplayName);
    }
}
