using FlowPro.Application.Common;

namespace FlowPro.Application.Accounts;

/// <summary>
/// Answers a sign-in challenge with a code from the authenticator app or a recovery code.
/// </summary>
public sealed record CompleteTwoFactorSignInCommand(
    string? ChallengeToken,
    string Code,
    ClientContext Client) : ICommand<IssuedSession>;

/// <summary>Creates a new authenticator secret to scan. Two-step sign-in stays off until confirmed.</summary>
public sealed record StartAuthenticatorSetupCommand(
    AccountCaller Caller,
    string CurrentPassword,
    ClientContext Client) : ICommand<AuthenticatorSetup>;

/// <param name="SharedKey">The secret in Base32, grouped for typing it in by hand.</param>
/// <param name="AuthenticatorUri">The <c>otpauth://</c> link to show as a QR code.</param>
public sealed record AuthenticatorSetup(string SharedKey, string AuthenticatorUri);

/// <summary>Turns two-step sign-in on with a first code from the newly set up app.</summary>
public sealed record EnableTwoFactorCommand(
    AccountCaller Caller,
    string Code,
    ClientContext Client) : ICommand<TwoFactorEnabled>;

/// <param name="RecoveryCodes">Shown this once; only their hashes are kept.</param>
/// <param name="OtherSessionsEnded">Sessions that signed in without a code and were ended.</param>
public sealed record TwoFactorEnabled(IReadOnlyList<string> RecoveryCodes, int OtherSessionsEnded);

public sealed record DisableTwoFactorCommand(
    AccountCaller Caller,
    string CurrentPassword,
    ClientContext Client) : ICommand<TwoFactorDisabled>;

public sealed record TwoFactorDisabled;

/// <summary>Replaces every recovery code, used or not, with new ones.</summary>
public sealed record RegenerateRecoveryCodesCommand(
    AccountCaller Caller,
    string CurrentPassword,
    ClientContext Client) : ICommand<RecoveryCodesIssued>;

public sealed record RecoveryCodesIssued(IReadOnlyList<string> RecoveryCodes);
