namespace FlowPro.Domain.Attendance;

/// <summary>
/// Statutory public holidays in Germany, computed for any year and any federal state.
/// </summary>
/// <remarks>
/// Public holidays are set by the states, so the set differs by where an employee works.
/// Because a public holiday counts toward target hours, the wrong set misstates flex balances
/// and the payroll export an employer has to defend.
///
/// This replaces a fixed table of 2026 dates that returned nothing for any other year, which
/// would have emptied the calendar on 1 January 2027. Movable feasts are derived from Easter
/// so no one has to maintain a table each December. The client carries the same rules in
/// <c>apps/web/src/domain/timesheet/german-holidays.ts</c>; the two must stay in step.
/// </remarks>
public static class GermanPublicHolidays
{
    /// <summary>The sixteen federal states, by their ISO 3166-2:DE codes.</summary>
    public static readonly IReadOnlySet<string> StateCodes = new HashSet<string>(
        StringComparer.OrdinalIgnoreCase)
    {
        "BW", "BY", "BE", "BB", "HB", "HH", "HE", "MV",
        "NI", "NW", "RP", "SL", "SN", "ST", "SH", "TH",
    };

    /// <summary>Easter Sunday for a Gregorian year, via the Anonymous Gregorian algorithm.</summary>
    public static DateOnly GetEasterSunday(int year)
    {
        int a = year % 19;
        int b = year / 100;
        int c = year % 100;
        int d = b / 4;
        int e = b % 4;
        int f = (b + 8) / 25;
        int g = (b - f + 1) / 3;
        int h = ((19 * a) + b - d - g + 15) % 30;
        int i = c / 4;
        int k = c % 4;
        int l = (32 + (2 * e) + (2 * i) - h - k) % 7;
        int m = (a + (11 * h) + (22 * l)) / 451;
        int month = (h + l - (7 * m) + 114) / 31;
        int day = ((h + l - (7 * m) + 114) % 31) + 1;

        return new DateOnly(year, month, day);
    }

    /// <summary>
    /// Statutory holidays for a year, narrowed to one federal state. An unrecognised state code
    /// yields the nationwide set, which is the subset every state observes.
    /// </summary>
    public static IReadOnlyDictionary<DateOnly, string> GetHolidays(int year, string? stateCode)
    {
        string? state = stateCode is not null && StateCodes.Contains(stateCode)
            ? stateCode.ToUpperInvariant()
            : null;

        DateOnly easter = GetEasterSunday(year);
        DateOnly FromEaster(int offset) => easter.AddDays(offset);

        Dictionary<DateOnly, string> holidays = new()
        {
            // Nationwide.
            [new DateOnly(year, 1, 1)] = "Neujahr",
            [FromEaster(-2)] = "Karfreitag",
            [FromEaster(1)] = "Ostermontag",
            [new DateOnly(year, 5, 1)] = "Tag der Arbeit",
            [FromEaster(39)] = "Christi Himmelfahrt",
            [FromEaster(50)] = "Pfingstmontag",
            [new DateOnly(year, 10, 3)] = "Tag der Deutschen Einheit",
            [new DateOnly(year, 12, 25)] = "1. Weihnachtstag",
            [new DateOnly(year, 12, 26)] = "2. Weihnachtstag",
        };

        if (state is null)
        {
            return holidays;
        }

        void AddFor(string name, DateOnly date, params string[] states)
        {
            if (states.Contains(state, StringComparer.OrdinalIgnoreCase))
            {
                holidays[date] = name;
            }
        }

        AddFor("Heilige Drei Könige", new DateOnly(year, 1, 6), "BW", "BY", "ST");
        AddFor("Internationaler Frauentag", new DateOnly(year, 3, 8), "BE", "MV");
        AddFor("Fronleichnam", FromEaster(60), "BW", "BY", "HE", "NW", "RP", "SL");

        // In Bayern this depends on the municipality's confessional majority, which needs data
        // this product does not hold, so only the state-wide case is claimed.
        AddFor("Mariä Himmelfahrt", new DateOnly(year, 8, 15), "SL");

        AddFor("Weltkindertag", new DateOnly(year, 9, 20), "TH");
        AddFor(
            "Reformationstag",
            new DateOnly(year, 10, 31),
            "BB", "HB", "HH", "MV", "NI", "SN", "ST", "SH", "TH");
        AddFor("Allerheiligen", new DateOnly(year, 11, 1), "BW", "BY", "NW", "RP", "SL");
        AddFor("Buß- und Bettag", GetRepentanceDay(year), "SN");

        return holidays;
    }

    /// <summary>Name of the statutory holiday on a date, or null.</summary>
    public static string? GetHolidayName(DateOnly date, string? stateCode) =>
        GetHolidays(date.Year, stateCode).GetValueOrDefault(date);

    /// <summary>
    /// Buß- und Bettag falls on the Wednesday before 23 November, and is a public holiday only
    /// in Sachsen.
    /// </summary>
    private static DateOnly GetRepentanceDay(int year)
    {
        DateOnly reference = new(year, 11, 23);
        int daysSinceWednesday = ((int)reference.DayOfWeek + 4) % 7;
        return reference.AddDays(-(daysSinceWednesday == 0 ? 7 : daysSinceWednesday));
    }
}
