using FlowPro.Application.Common;
using FlowPro.Domain.Identity;

namespace FlowPro.Application.Accounts;

/// <summary>
/// Lists the workspaces of the signed-in account and moves its session between them.
/// </summary>
/// <remarks>
/// A session acts in one workspace at a time. Switching changes only this session, so another
/// device stays where it was. A workspace the account does not belong to is answered like one
/// that does not exist.
/// </remarks>
public sealed class AccountWorkspaceHandler(
    IAccountWorkspaces workspaces,
    IAccountSessionRepository sessions,
    IUnitOfWork unitOfWork) :
    IQueryHandler<ListWorkspacesQuery, WorkspaceList>,
    ICommandHandler<SwitchWorkspaceCommand, WorkspaceSwitched>
{
    public const string WorkspaceNotFoundCode = "account.workspace_not_found";

    public async Task<WorkspaceList> HandleAsync(
        ListWorkspacesQuery query,
        CancellationToken cancellationToken)
    {
        AccountSession session = await RequireSessionAsync(query.Caller, cancellationToken);
        IReadOnlyList<AccountWorkspace> memberships = await workspaces.ListAsync(
            query.Caller.AccountId,
            cancellationToken);
        Guid? current = WorkspaceSelection.Current(memberships, session.ActiveTenantId);

        return new WorkspaceList(
        [
            .. memberships.Select(workspace => new WorkspaceSummary(
                workspace.TenantId,
                workspace.Name,
                workspace.TenantId == current)),
        ]);
    }

    public Task<WorkspaceSwitched> HandleAsync(
        SwitchWorkspaceCommand command,
        CancellationToken cancellationToken) =>
        unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                AccountSession session = await RequireSessionAsync(command.Caller, transactionCancellationToken);
                IReadOnlyList<AccountWorkspace> memberships = await workspaces.ListAsync(
                    command.Caller.AccountId,
                    transactionCancellationToken);

                if (memberships.All(workspace => workspace.TenantId != command.TenantId))
                {
                    throw new FlowProNotFoundException(
                        WorkspaceNotFoundCode,
                        "You do not belong to that workspace.");
                }

                session.SelectTenant(command.TenantId);
                return new WorkspaceSwitched(command.TenantId);
            },
            cancellationToken);

    private async Task<AccountSession> RequireSessionAsync(
        AccountCaller caller,
        CancellationToken cancellationToken)
    {
        AccountSession? session = await sessions.FindByIdAsync(caller.SessionId, cancellationToken);

        return session is not null && session.AccountId == caller.AccountId && session.RevokedAt is null
            ? session
            : throw new FlowProUnauthorizedException();
    }
}
