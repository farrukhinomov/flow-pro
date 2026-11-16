using FlowPro.Domain.Common;
using FlowPro.Domain.Identity;

namespace FlowPro.Domain.Tests.Identity;

public sealed class UserPreferencesRecordTests
{
    private static UserPreferencesRecord CreateRecord() =>
        new(Guid.CreateVersion7(), Guid.CreateVersion7());

    [Fact]
    public void New_record_uses_product_defaults()
    {
        UserPreferencesRecord preferences = CreateRecord();

        Assert.Equal("en", preferences.Locale);
        Assert.Equal("Europe/Berlin", preferences.TimeZoneId);
        Assert.Equal("monday", preferences.WeekStart);
        Assert.Equal("office", preferences.DefaultWorkLocation);
        Assert.False(preferences.DensityCompact);
        Assert.True(preferences.ShowSyncStatus);
        Assert.True(preferences.ShowPolicyHints);
        Assert.True(preferences.FullWidthPages);
    }

    [Fact]
    public void Update_stores_valid_preferences()
    {
        UserPreferencesRecord preferences = CreateRecord();

        preferences.Update("de", "Europe/Vienna", "sunday", "home-office", true, false, false, false);

        Assert.Equal("de", preferences.Locale);
        Assert.Equal("Europe/Vienna", preferences.TimeZoneId);
        Assert.Equal("sunday", preferences.WeekStart);
        Assert.Equal("home-office", preferences.DefaultWorkLocation);
        Assert.True(preferences.DensityCompact);
        Assert.False(preferences.ShowSyncStatus);
    }

    [Fact]
    public void Update_normalizes_choice_casing_and_whitespace()
    {
        UserPreferencesRecord preferences = CreateRecord();

        preferences.Update("de", "UTC", "  SUNDAY ", " Home-Office ", false, true, true, true);

        Assert.Equal("sunday", preferences.WeekStart);
        Assert.Equal("home-office", preferences.DefaultWorkLocation);
    }

    [Fact]
    public void Update_falls_back_to_defaults_for_blank_values()
    {
        UserPreferencesRecord preferences = CreateRecord();

        preferences.Update("  ", "  ", "  ", "  ", false, true, true, true);

        Assert.Equal("en", preferences.Locale);
        Assert.Equal("Europe/Berlin", preferences.TimeZoneId);
        Assert.Equal("monday", preferences.WeekStart);
        Assert.Equal("office", preferences.DefaultWorkLocation);
    }

    [Fact]
    public void Update_rejects_an_unknown_time_zone()
    {
        UserPreferencesRecord preferences = CreateRecord();

        // A stored zone is used for later conversions, so an unusable value
        // must not reach the database.
        DomainRuleException error = Assert.Throws<DomainRuleException>(
            () => preferences.Update("en", "Mars/Olympus", "monday", "office", false, true, true, true));

        Assert.Equal("preferences.time-zone.invalid", error.Code);
    }

    [Fact]
    public void Update_rejects_an_unknown_week_start()
    {
        UserPreferencesRecord preferences = CreateRecord();

        DomainRuleException error = Assert.Throws<DomainRuleException>(
            () => preferences.Update("en", "UTC", "caturday", "office", false, true, true, true));

        Assert.Equal("preferences.week-start.invalid", error.Code);
    }

    [Fact]
    public void Update_rejects_an_unknown_work_location()
    {
        UserPreferencesRecord preferences = CreateRecord();

        DomainRuleException error = Assert.Throws<DomainRuleException>(
            () => preferences.Update("en", "UTC", "monday", "the-beach", false, true, true, true));

        Assert.Equal("preferences.work-location.invalid", error.Code);
    }

    [Fact]
    public void Update_rejects_an_overlong_locale_tag()
    {
        UserPreferencesRecord preferences = CreateRecord();

        DomainRuleException error = Assert.Throws<DomainRuleException>(
            () => preferences.Update(
                new string('x', 32),
                "UTC",
                "monday",
                "office",
                false,
                true,
                true,
                true));

        Assert.Equal("preferences.locale.invalid", error.Code);
    }

    [Fact]
    public void Update_increments_the_version_for_optimistic_concurrency()
    {
        UserPreferencesRecord preferences = CreateRecord();
        long before = preferences.Version;

        preferences.Update("de", "UTC", "monday", "office", false, true, true, true);

        Assert.Equal(before + 1, preferences.Version);
    }
}
