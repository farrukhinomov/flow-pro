using FlowPro.Application.Common;

namespace FlowPro.Application.Accounts;

/// <summary>The workspaces the signed-in account belongs to, with the one this session acts in.</summary>
public sealed record ListWorkspacesQuery(AccountCaller Caller) : IQuery<WorkspaceList>;

public sealed record WorkspaceList(IReadOnlyList<WorkspaceSummary> Workspaces);

/// <param name="IsCurrent">True for the workspace this session acts in.</param>
public sealed record WorkspaceSummary(Guid TenantId, string Name, bool IsCurrent);

/// <summary>Makes this session act in another workspace the account belongs to.</summary>
public sealed record SwitchWorkspaceCommand(AccountCaller Caller, Guid TenantId)
    : ICommand<WorkspaceSwitched>;

public sealed record WorkspaceSwitched(Guid TenantId);

/// <summary>An active membership of an account in an active workspace.</summary>
public sealed record AccountWorkspace(Guid TenantId, string Name, DateTimeOffset JoinedAt);

/// <summary>Which workspace a session acts in.</summary>
public static class WorkspaceSelection
{
    /// <summary>
    /// The workspace a new session starts in: the one the account chose last, while it still
    /// belongs to it, otherwise the one it joined first. Null when it belongs to none yet.
    /// </summary>
    public static Guid? ChooseDefault(IReadOnlyList<AccountWorkspace> workspaces, Guid? lastChosen)
    {
        ArgumentNullException.ThrowIfNull(workspaces);

        if (lastChosen is not null && workspaces.Any(workspace => workspace.TenantId == lastChosen))
        {
            return lastChosen;
        }

        return workspaces
            .OrderBy(workspace => workspace.JoinedAt)
            .ThenBy(workspace => workspace.TenantId)
            .Select(workspace => (Guid?)workspace.TenantId)
            .FirstOrDefault();
    }

    /// <summary>
    /// The workspace a session acts in, by the same rule the API uses to resolve the caller: the
    /// session's chosen workspace while the account still belongs to it, otherwise the only one.
    /// With several and none chosen, none: guessing would act in the wrong workspace.
    /// </summary>
    public static Guid? Current(IReadOnlyList<AccountWorkspace> workspaces, Guid? chosen)
    {
        ArgumentNullException.ThrowIfNull(workspaces);

        if (chosen is not null && workspaces.Any(workspace => workspace.TenantId == chosen))
        {
            return chosen;
        }

        return workspaces.Count == 1 ? workspaces[0].TenantId : null;
    }
}
