using System.Text;
using FlowPro.Domain.Onboarding;

namespace FlowPro.Application.Onboarding;

/// <summary>
/// Shared constants for workspace provisioning and the setup wizard.
/// </summary>
public static class OnboardingDefaults
{
    public const string NotConfiguredWorkPatternExternalId = "work-pattern-not-configured";
    public const string DefaultWorkPatternExternalId = "work-pattern-default";
    public const string DefaultLocationCode = "HQ";

    /// <summary>
    /// 40 hours a week, the common German full-time baseline, until the company step overrides it.
    /// </summary>
    public const int DefaultWeeklyMinutes = 2_400;

    /// <summary>
    /// The German Arbeitszeitgesetz caps the working week at 48 hours averaged over six months,
    /// with 60 as the absolute ceiling. Configuration above that is refused.
    /// </summary>
    public const decimal MaxWeeklyHours = 60m;

    public const decimal MinWeeklyHours = 1m;

    /// <summary>
    /// Personal mailbox providers, where the email domain says nothing about the company name.
    /// </summary>
    public static readonly IReadOnlySet<string> ConsumerEmailDomains =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "aol.com",
            "gmail.com",
            "gmx.de",
            "gmx.net",
            "googlemail.com",
            "hotmail.com",
            "icloud.com",
            "live.com",
            "mail.ru",
            "me.com",
            "outlook.com",
            "outlook.de",
            "posteo.de",
            "proton.me",
            "protonmail.com",
            "t-online.de",
            "web.de",
            "yahoo.com",
            "yandex.ru",
        };

    public static string ToWireFormat(OnboardingStep step) => step switch
    {
        OnboardingStep.Company => "company",
        OnboardingStep.Team => "team",
        OnboardingStep.Absences => "absences",
        OnboardingStep.FirstClockIn => "first-clock-in",
        _ => throw new ArgumentOutOfRangeException(nameof(step)),
    };

    public static bool TryParseStep(string? value, out OnboardingStep step)
    {
        switch (value?.Trim().ToLowerInvariant())
        {
            case "company":
                step = OnboardingStep.Company;
                return true;
            case "team":
                step = OnboardingStep.Team;
                return true;
            case "absences":
                step = OnboardingStep.Absences;
                return true;
            case "first-clock-in":
                step = OnboardingStep.FirstClockIn;
                return true;
            default:
                step = default;
                return false;
        }
    }
}

/// <summary>
/// Derives a URL safe workspace address from free text. The result always satisfies the tenant slug
/// invariant: lowercase ASCII letters, digits, and internal hyphens only.
/// </summary>
public static class OnboardingSlug
{
    private const int MaxLength = 80;
    private const string Fallback = "workspace";

    public static string Create(string source)
    {
        StringBuilder builder = new(source.Length);
        bool lastWasHyphen = false;

        foreach (char character in source.Trim().ToLowerInvariant())
        {
            if (char.IsAsciiLetterOrDigit(character))
            {
                builder.Append(character);
                lastWasHyphen = false;
                continue;
            }

            string transliterated = Transliterate(character);

            if (transliterated.Length > 0)
            {
                builder.Append(transliterated);
                lastWasHyphen = false;
                continue;
            }

            if (builder.Length > 0 && !lastWasHyphen)
            {
                builder.Append('-');
                lastWasHyphen = true;
            }
        }

        string slug = builder.ToString().Trim('-');

        if (slug.Length > MaxLength)
        {
            slug = slug[..MaxLength].Trim('-');
        }

        return slug.Length == 0 ? Fallback : slug;
    }

    public static string WithSuffix(string baseSlug, int suffix)
    {
        string suffixValue = $"-{suffix}";
        string trimmed = baseSlug.Length + suffixValue.Length > MaxLength
            ? baseSlug[..(MaxLength - suffixValue.Length)].Trim('-')
            : baseSlug;

        return $"{trimmed}{suffixValue}";
    }

    private static string Transliterate(char character) => character switch
    {
        'ä' => "ae",
        'ö' => "oe",
        'ü' => "ue",
        'ß' => "ss",
        'á' or 'à' or 'â' or 'å' => "a",
        'é' or 'è' or 'ê' => "e",
        'í' or 'ì' or 'î' => "i",
        'ó' or 'ò' or 'ô' => "o",
        'ú' or 'ù' or 'û' => "u",
        'ç' => "c",
        'ñ' => "n",
        _ => string.Empty,
    };
}
