using System.Buffers.Binary;
using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace FlowPro.Application.Accounts;

/// <summary>
/// Time-based one-time passwords as defined by RFC 6238, the format every authenticator app reads:
/// HMAC-SHA1, six digits, a new code every 30 seconds.
/// </summary>
public static class Totp
{
    public const int Digits = 6;
    public const int PeriodSeconds = 30;

    /// <summary>160 bits, the key length RFC 4226 recommends for HMAC-SHA1.</summary>
    public const int KeyBytes = 20;

    /// <summary>
    /// How many steps before and after the current one are accepted, so a phone clock that is a
    /// little off, or a code typed just as it changed, still works.
    /// </summary>
    public const int AllowedDriftSteps = 1;

    public static byte[] GenerateKey() => RandomNumberGenerator.GetBytes(KeyBytes);

    public static long TimeStep(DateTimeOffset at) => at.ToUnixTimeSeconds() / PeriodSeconds;

    // SHA-1's collision weakness does not affect HMAC-SHA1, and authenticator apps only reliably
    // support SHA-1, so RFC 6238's default stays the right choice here.
    [SuppressMessage(
        "Security",
        "CA5350:Do Not Use Weak Cryptographic Algorithms",
        Justification = "RFC 6238 authenticator apps use HMAC-SHA1, which collisions do not weaken.")]
    public static string Compute(ReadOnlySpan<byte> key, long timeStep)
    {
        Span<byte> counter = stackalloc byte[8];
        BinaryPrimitives.WriteInt64BigEndian(counter, timeStep);
        Span<byte> hash = stackalloc byte[HMACSHA1.HashSizeInBytes];
        HMACSHA1.HashData(key, counter, hash);

        // Dynamic truncation, RFC 4226 section 5.3.
        int offset = hash[^1] & 0x0F;
        int binary = BinaryPrimitives.ReadInt32BigEndian(hash[offset..]) & 0x7FFF_FFFF;

        return (binary % 1_000_000).ToString("D6", CultureInfo.InvariantCulture);
    }

    /// <summary>
    /// Checks <paramref name="code" /> against the steps around <paramref name="now" />.
    /// </summary>
    /// <returns>The time step the code belongs to, or null when it matches none.</returns>
    public static long? Verify(ReadOnlySpan<byte> key, string? code, DateTimeOffset now)
    {
        if (Normalize(code) is not { } normalized)
        {
            return null;
        }

        byte[] expected = Encoding.ASCII.GetBytes(normalized);
        long current = TimeStep(now);
        long? match = null;

        // Every step is compared, so the time taken does not reveal which one matched.
        for (long step = current - AllowedDriftSteps; step <= current + AllowedDriftSteps; step++)
        {
            byte[] actual = Encoding.ASCII.GetBytes(Compute(key, step));

            if (CryptographicOperations.FixedTimeEquals(actual, expected))
            {
                match ??= step;
            }
        }

        return match;
    }

    /// <summary>Six digits, ignoring spaces and dashes apps show for readability; otherwise null.</summary>
    public static string? Normalize(string? code)
    {
        if (code is null)
        {
            return null;
        }

        string digits = new([.. code.Where(character => character is not (' ' or '-'))]);

        return digits.Length == Digits && digits.All(char.IsAsciiDigit) ? digits : null;
    }

    /// <summary>
    /// The <c>otpauth://</c> link a QR code carries, in the format authenticator apps understand.
    /// </summary>
    public static string AuthenticatorUri(string issuer, string accountName, ReadOnlySpan<byte> key)
    {
        string label = $"{Uri.EscapeDataString(issuer)}:{Uri.EscapeDataString(accountName)}";

        return $"otpauth://totp/{label}?secret={Base32.Encode(key)}&issuer={Uri.EscapeDataString(issuer)}"
            + $"&algorithm=SHA1&digits={Digits}&period={PeriodSeconds}";
    }
}

/// <summary>RFC 4648 Base32 without padding, how authenticator apps expect a typed-in key.</summary>
public static class Base32
{
    private const string Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    public static string Encode(ReadOnlySpan<byte> data)
    {
        StringBuilder builder = new((data.Length * 8 + 4) / 5);
        int buffer = 0;
        int bits = 0;

        foreach (byte value in data)
        {
            buffer = (buffer << 8) | value;
            bits += 8;

            while (bits >= 5)
            {
                builder.Append(Alphabet[(buffer >> (bits - 5)) & 31]);
                bits -= 5;
            }
        }

        if (bits > 0)
        {
            builder.Append(Alphabet[(buffer << (5 - bits)) & 31]);
        }

        return builder.ToString();
    }

    /// <summary>Accepts lower case, spaces and padding.</summary>
    /// <exception cref="FormatException">A character outside the alphabet.</exception>
    public static byte[] Decode(string text)
    {
        ArgumentNullException.ThrowIfNull(text);
        List<byte> bytes = new(text.Length * 5 / 8);
        int buffer = 0;
        int bits = 0;

        foreach (char character in text)
        {
            if (character is ' ' or '=')
            {
                continue;
            }

            int index = Alphabet.IndexOf(char.ToUpperInvariant(character), StringComparison.Ordinal);

            if (index < 0)
            {
                throw new FormatException($"'{character}' is not a Base32 character.");
            }

            buffer = (buffer << 5) | index;
            bits += 5;

            if (bits >= 8)
            {
                bytes.Add((byte)(buffer >> (bits - 8)));
                bits -= 8;
            }
        }

        return [.. bytes];
    }
}
