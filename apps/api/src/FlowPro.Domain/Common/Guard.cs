namespace FlowPro.Domain.Common;

internal static class Guard
{
    public static string Required(string? value, string name, int maxLength)
    {
        string normalized = value?.Trim() ?? string.Empty;

        if (normalized.Length == 0)
        {
            throw new ArgumentException($"{name} is required.", name);
        }

        if (normalized.Length > maxLength)
        {
            throw new ArgumentException($"{name} cannot exceed {maxLength} characters.", name);
        }

        return normalized;
    }

    public static string Slug(string? value)
    {
        string slug = Required(value, "Slug", 80).ToLowerInvariant();

        if (slug[0] == '-' || slug[^1] == '-' || slug.Any(character => !char.IsAsciiLetterOrDigit(character) && character != '-'))
        {
            throw new ArgumentException("Slug may contain only ASCII letters, digits, and internal hyphens.", nameof(value));
        }

        return slug;
    }
}
