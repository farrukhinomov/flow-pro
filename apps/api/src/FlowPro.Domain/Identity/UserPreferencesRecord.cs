using FlowPro.Domain.Common;

namespace FlowPro.Domain.Identity;

/// <summary>
/// Per-user interface preferences: language, time zone, week start, default
/// work location, and display toggles.
/// </summary>
/// <remarks>
/// These lived only in browser local storage, so a user who signed in on a
/// second device got English and the browser time zone again regardless of what
/// they had chosen. Time zone in particular affects how booked times are read,
/// so it belongs with the account rather than with one browser profile.
/// </remarks>
public sealed class UserPreferencesRecord : ITrackedEntity
{
    public const string DefaultLocale = "en";
    public const string DefaultTimeZoneId = "Europe/Berlin";
    public const string DefaultWeekStart = "monday";
    public const string DefaultWorkLocationValue = "office";

    private static readonly string[] AllowedWeekStarts = ["monday", "sunday"];
    private static readonly string[] AllowedWorkLocations = ["office", "home-office"];

    private UserPreferencesRecord()
    {
    }

    public UserPreferencesRecord(Guid tenantId, Guid ownerUserId)
    {
        Id = Guid.CreateVersion7();
        TenantId = tenantId;
        OwnerUserId = ownerUserId;
        Locale = DefaultLocale;
        TimeZoneId = DefaultTimeZoneId;
        WeekStart = DefaultWeekStart;
        DefaultWorkLocation = DefaultWorkLocationValue;
        ShowSyncStatus = true;
        ShowPolicyHints = true;
        FullWidthPages = true;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid OwnerUserId { get; private set; }

    public string Locale { get; private set; } = DefaultLocale;

    public string TimeZoneId { get; private set; } = DefaultTimeZoneId;

    public string WeekStart { get; private set; } = DefaultWeekStart;

    public string DefaultWorkLocation { get; private set; } = DefaultWorkLocationValue;

    public bool DensityCompact { get; private set; }

    public bool ShowSyncStatus { get; private set; } = true;

    public bool ShowPolicyHints { get; private set; } = true;

    public bool FullWidthPages { get; private set; } = true;

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public long Version { get; private set; }

    public void Update(
        string locale,
        string timeZoneId,
        string weekStart,
        string defaultWorkLocation,
        bool densityCompact,
        bool showSyncStatus,
        bool showPolicyHints,
        bool fullWidthPages)
    {
        Locale = NormalizeLocale(locale);
        TimeZoneId = NormalizeTimeZone(timeZoneId);
        WeekStart = NormalizeChoice(weekStart, AllowedWeekStarts, DefaultWeekStart, "preferences.week-start.invalid");
        DefaultWorkLocation = NormalizeChoice(
            defaultWorkLocation,
            AllowedWorkLocations,
            DefaultWorkLocationValue,
            "preferences.work-location.invalid");
        DensityCompact = densityCompact;
        ShowSyncStatus = showSyncStatus;
        ShowPolicyHints = showPolicyHints;
        FullWidthPages = fullWidthPages;
        Version++;
    }

    private static string NormalizeLocale(string locale)
    {
        string trimmed = locale?.Trim() ?? string.Empty;

        if (trimmed.Length is 0)
        {
            return DefaultLocale;
        }

        // Stored as a plain BCP 47 tag. The tag is validated for shape only:
        // the set of locales the product ships is a client concern, and
        // rejecting an unknown tag here would break a client that adds one.
        if (trimmed.Length > 16)
        {
            throw new DomainRuleException(
                "preferences.locale.invalid",
                "Locale must be a BCP 47 language tag.");
        }

        return trimmed;
    }

    private static string NormalizeTimeZone(string timeZoneId)
    {
        string trimmed = timeZoneId?.Trim() ?? string.Empty;

        if (trimmed.Length is 0)
        {
            return DefaultTimeZoneId;
        }

        // Validated against the platform database so a stored zone can always
        // be used for a conversion later.
        if (!TimeZoneInfo.TryFindSystemTimeZoneById(trimmed, out _))
        {
            throw new DomainRuleException(
                "preferences.time-zone.invalid",
                $"'{trimmed}' is not a known IANA time zone.");
        }

        return trimmed;
    }

    private static string NormalizeChoice(
        string value,
        string[] allowed,
        string fallback,
        string errorCode)
    {
        string trimmed = value?.Trim().ToLowerInvariant() ?? string.Empty;

        if (trimmed.Length is 0)
        {
            return fallback;
        }

        if (!allowed.Contains(trimmed))
        {
            throw new DomainRuleException(
                errorCode,
                $"'{value}' must be one of: {string.Join(", ", allowed)}.");
        }

        return trimmed;
    }
}
