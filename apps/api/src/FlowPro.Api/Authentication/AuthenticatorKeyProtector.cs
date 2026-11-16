using FlowPro.Application.Accounts;
using Microsoft.AspNetCore.DataProtection;

namespace FlowPro.Api.Authentication;

/// <summary>
/// Encrypts authenticator secrets with ASP.NET Core Data Protection. The keys live outside the
/// database (see <see cref="DataProtectionExtensions" />), so a database copy alone does not reveal
/// the secrets.
/// </summary>
/// <remarks>
/// The keys must survive restarts and be shared by every API instance; otherwise people with
/// two-step sign-in cannot sign in any more. The compose files keep them in a volume.
/// </remarks>
internal sealed class AuthenticatorKeyProtector(IDataProtectionProvider provider) : IAuthenticatorKeyProtector
{
    private readonly IDataProtector protector = provider.CreateProtector("FlowPro.Accounts.AuthenticatorKey.v1");

    public string Protect(byte[] key) => Convert.ToBase64String(protector.Protect(key));

    public byte[] Unprotect(string protectedKey) => protector.Unprotect(Convert.FromBase64String(protectedKey));
}
