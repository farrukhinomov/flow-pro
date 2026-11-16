using System.Security.Cryptography;

namespace FlowPro.Application.Accounts;

/// <summary>
/// Single-use codes that stand in for the authenticator app, shown once when they are created.
/// </summary>
/// <remarks>
/// A code is 16 characters from an alphabet without look-alikes (no 0/o, 1/l/i), about 79 bits of
/// randomness. That is far beyond guessing, so like session tokens only a SHA-256 hash is stored
/// and no slow hash is needed.
/// </remarks>
public static class RecoveryCodes
{
    public const int Count = 10;

    private const string Alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
    private const int Length = 16;
    private const int GroupLength = 4;

    /// <summary>New codes, formatted for reading, such as <c>k7mq-2xfd-9tna-hrwe</c>.</summary>
    public static IReadOnlyList<string> Generate()
    {
        string[] codes = new string[Count];

        for (int index = 0; index < Count; index++)
        {
            char[] characters = new char[Length];

            for (int position = 0; position < Length; position++)
            {
                characters[position] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
            }

            codes[index] = string.Join('-', new string(characters).Chunk(GroupLength).Select(group => new string(group)));
        }

        return codes;
    }

    /// <summary>
    /// The code without separators and in lower case, or null when it cannot be a recovery code.
    /// </summary>
    public static string? Normalize(string? code)
    {
        if (code is null)
        {
            return null;
        }

        string compact = new([.. code.Where(character => character is not (' ' or '-')).Select(char.ToLowerInvariant)]);

        return compact.Length == Length && compact.All(character => Alphabet.Contains(character, StringComparison.Ordinal))
            ? compact
            : null;
    }

    /// <summary>The stored form of a normalized code.</summary>
    public static string Hash(string normalizedCode) => SessionToken.Hash(normalizedCode);
}
