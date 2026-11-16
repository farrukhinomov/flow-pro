using FlowPro.Application.Common;
using FlowPro.Application.Demo;

namespace FlowPro.Application.Accounts;

/// <summary>
/// Keeps the demo's shared logins usable for every visitor.
/// </summary>
/// <remarks>
/// Everyone signs in to the same few accounts, so one visitor must not be able to lock the others
/// out until the nightly reset: no password, email or two-step sign-in change, no ending other
/// visitors' sessions, no lockout from wrong passwords (the password is public anyway), and no
/// deactivating or editing the logins' memberships. On an instance without the demo, nothing is
/// shared.
/// </remarks>
public sealed class SharedAccountPolicy(DemoOptions options)
{
    public const string SharedAccountCode = "account.shared_demo_account";
    public const string SharedMembershipCode = "user.shared_demo_login";

    public bool IsShared(Guid? accountId) =>
        options.Enabled && accountId is { } id && DemoWorkspace.IsDemoAccount(id);

    /// <exception cref="FlowProForbiddenException">The account is a shared demo login.</exception>
    public void EnsureAccountCanChange(Guid accountId)
    {
        if (IsShared(accountId))
        {
            throw new FlowProForbiddenException(
                SharedAccountCode,
                "This is a shared demo login, so its sign-in settings cannot be changed.");
        }
    }

    /// <exception cref="FlowProForbiddenException">The membership belongs to a shared demo login.</exception>
    public void EnsureMembershipCanChange(Guid? accountId)
    {
        if (IsShared(accountId))
        {
            throw new FlowProForbiddenException(
                SharedMembershipCode,
                "This person is one of the shared demo logins, so they cannot be changed or deactivated.");
        }
    }
}
