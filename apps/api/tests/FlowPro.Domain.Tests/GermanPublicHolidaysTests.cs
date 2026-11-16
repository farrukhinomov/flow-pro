using FlowPro.Domain.Attendance;

namespace FlowPro.Domain.Tests;

/// <summary>
/// Mirrors the client's german-holidays tests. The two implementations must agree, because one
/// drives the timesheet on screen and the other the payroll export that leaves the building.
/// </summary>
public sealed class GermanPublicHolidaysTests
{
    [Theory]
    [InlineData(2024, "2024-03-31")]
    [InlineData(2025, "2025-04-20")]
    [InlineData(2026, "2026-04-05")]
    [InlineData(2027, "2027-03-28")]
    [InlineData(2030, "2030-04-21")]
    [InlineData(2038, "2038-04-25")]
    public void Easter_matches_published_dates(int year, string expected)
    {
        Assert.Equal(
            DateOnly.Parse(expected, System.Globalization.CultureInfo.InvariantCulture),
            GermanPublicHolidays.GetEasterSunday(year));
    }

    [Fact]
    public void Movable_feasts_match_the_previously_hardcoded_2026_dates()
    {
        IReadOnlyDictionary<DateOnly, string> holidays =
            GermanPublicHolidays.GetHolidays(2026, null);

        Assert.Equal("Karfreitag", holidays[new DateOnly(2026, 4, 3)]);
        Assert.Equal("Ostermontag", holidays[new DateOnly(2026, 4, 6)]);
        Assert.Equal("Christi Himmelfahrt", holidays[new DateOnly(2026, 5, 14)]);
        Assert.Equal("Pfingstmontag", holidays[new DateOnly(2026, 5, 25)]);
    }

    [Fact]
    public void Nationwide_set_has_nine_holidays()
    {
        Assert.Equal(9, GermanPublicHolidays.GetHolidays(2027, null).Count);
    }

    [Theory]
    [InlineData(2025)]
    [InlineData(2027)]
    [InlineData(2028)]
    [InlineData(2030)]
    public void Every_year_yields_a_calendar(int year)
    {
        // The regression this guards: the previous fixed table held 2026 only, so the payroll
        // export would have seen no public holidays at all from 1 January 2027.
        IReadOnlyDictionary<DateOnly, string> holidays =
            GermanPublicHolidays.GetHolidays(year, null);

        Assert.NotEmpty(holidays);
        Assert.All(holidays, holiday => Assert.Equal(year, holiday.Key.Year));
    }

    [Fact]
    public void Bayern_observes_more_days_than_Berlin()
    {
        // Twelve, not the thirteen usually quoted: that figure counts Mariä Himmelfahrt, which
        // in Bayern applies only in municipalities with a Catholic majority.
        Assert.Equal(12, GermanPublicHolidays.GetHolidays(2026, "BY").Count);
        Assert.Equal(10, GermanPublicHolidays.GetHolidays(2026, "BE").Count);

        Assert.Equal(
            "Fronleichnam",
            GermanPublicHolidays.GetHolidayName(new DateOnly(2026, 6, 4), "BY"));
        Assert.Null(GermanPublicHolidays.GetHolidayName(new DateOnly(2026, 6, 4), "BE"));
    }

    [Fact]
    public void Repentance_day_is_the_Wednesday_before_23_November_in_Sachsen_only()
    {
        Assert.Equal(
            "Buß- und Bettag",
            GermanPublicHolidays.GetHolidayName(new DateOnly(2026, 11, 18), "SN"));
        Assert.Null(GermanPublicHolidays.GetHolidayName(new DateOnly(2026, 11, 18), "TH"));

        foreach (int year in new[] { 2025, 2027, 2028 })
        {
            DateOnly date = GermanPublicHolidays.GetHolidays(year, "SN")
                .First(holiday => holiday.Value == "Buß- und Bettag").Key;

            Assert.Equal(DayOfWeek.Wednesday, date.DayOfWeek);
        }
    }

    [Fact]
    public void Unknown_state_code_falls_back_to_the_nationwide_set()
    {
        Assert.Equal(9, GermanPublicHolidays.GetHolidays(2026, "XX").Count);
        Assert.Equal(9, GermanPublicHolidays.GetHolidays(2026, "DE").Count);
        Assert.Equal(9, GermanPublicHolidays.GetHolidays(2026, null).Count);
    }
}
