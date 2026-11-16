using FlowPro.Domain.Common;

namespace FlowPro.Domain.Tenancy;

public sealed class Tenant : ITrackedEntity
{
    private Tenant()
    {
    }

    public Tenant(string slug, string name, Guid? id = null)
    {
        Id = id ?? Guid.CreateVersion7();
        Slug = Guard.Slug(slug);
        Name = Guard.Required(name, nameof(name), 200);
        IsActive = true;
        Version = 1;
    }

    public Guid Id { get; private set; }

    public string Slug { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public bool IsActive { get; private set; }

    /// <summary>
    /// Gets the ISO 3166-1 alpha-2 country code the workspace operates under.
    /// </summary>
    public string? CountryCode { get; private set; }

    /// <summary>
    /// Gets the ISO 3166-2 subdivision code, for example <c>DE-SL</c> for Saarland. Public holiday
    /// calendars in Germany are set per Bundesland, so the region drives holiday resolution.
    /// </summary>
    public string? RegionCode { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public long Version { get; private set; }

    public void UpdateProfile(string name, string? countryCode, string? regionCode)
    {
        Name = Guard.Required(name, nameof(name), 200);
        CountryCode = NormalizeCountryCode(countryCode);
        RegionCode = NormalizeRegionCode(regionCode, CountryCode);
        Version++;
    }

    public void Deactivate()
    {
        IsActive = false;
        Version++;
    }

    private static string? NormalizeCountryCode(string? countryCode)
    {
        if (string.IsNullOrWhiteSpace(countryCode))
        {
            return null;
        }

        string normalized = countryCode.Trim().ToUpperInvariant();

        if (normalized.Length != 2 || !normalized.All(char.IsAsciiLetterUpper))
        {
            throw new DomainRuleException(
                "tenant.country_code_invalid",
                "Country must be an ISO 3166-1 alpha-2 code.");
        }

        return normalized;
    }

    private static string? NormalizeRegionCode(string? regionCode, string? countryCode)
    {
        if (string.IsNullOrWhiteSpace(regionCode))
        {
            return null;
        }

        if (countryCode is null)
        {
            throw new DomainRuleException(
                "tenant.region_requires_country",
                "A region cannot be set without a country.");
        }

        string normalized = regionCode.Trim().ToUpperInvariant();

        if (normalized.Length is < 4 or > 10
            || !normalized.StartsWith($"{countryCode}-", StringComparison.Ordinal)
            || !normalized[3..].All(char.IsAsciiLetterOrDigit))
        {
            throw new DomainRuleException(
                "tenant.region_code_invalid",
                "Region must be an ISO 3166-2 code within the selected country.");
        }

        return normalized;
    }
}
