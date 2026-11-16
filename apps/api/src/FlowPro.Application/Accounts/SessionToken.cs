using System.Security.Cryptography;
using System.Text;

namespace FlowPro.Application.Accounts;

/// <summary>
/// The secret a browser presents to prove it owns a session.
/// </summary>
/// <remarks>
/// The token is 256 bits from the system's cryptographic random source. Only its SHA-256 hash is
/// stored. A slow password hash is not needed here: the token is not guessable, so there is
/// nothing for an attacker to brute-force.
/// </remarks>
public static class SessionToken
{
    private const int TokenBytes = 32;

    public static string Generate()
    {
        Span<byte> bytes = stackalloc byte[TokenBytes];
        RandomNumberGenerator.Fill(bytes);

        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    public static string Hash(string token)
    {
        byte[] hash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexStringLower(hash);
    }

    /// <summary>A cheap shape check, so obviously invalid values never reach the database.</summary>
    public static bool LooksValid(string? token) =>
        token is { Length: 43 } && token.All(IsBase64UrlCharacter);

    private static bool IsBase64UrlCharacter(char character) =>
        char.IsAsciiLetterOrDigit(character) || character is '-' or '_';
}
