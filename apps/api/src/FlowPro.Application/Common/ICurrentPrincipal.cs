namespace FlowPro.Application.Common;

/// <summary>
/// The signed-in caller, before any FlowPro tenant or membership has been resolved.
/// </summary>
/// <remarks>
/// <see cref="ICurrentRequestContext" /> only resolves once the caller is already a member of a
/// tenant. Self-serve signup runs before that is true: the caller has an account but no workspace
/// yet, so provisioning reads identity from the session claims instead.
/// </remarks>
public interface ICurrentPrincipal
{
    PrincipalIdentity GetRequiredPrincipal();

    PrincipalIdentity? TryGetPrincipal();
}

/// <param name="AccountId">
/// Set when the caller signed in with a FlowPro account rather than an external token.
/// </param>
public sealed record PrincipalIdentity(
    string ExternalSubject,
    string Email,
    string DisplayName,
    Guid? AccountId = null);
