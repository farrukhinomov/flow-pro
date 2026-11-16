using FlowPro.Domain.Common;
using FlowPro.Domain.Tenancy;

namespace FlowPro.Domain.Tests.Tenancy;

public sealed class TenantTests
{
    [Fact]
    public void New_tenant_is_active_without_a_country()
    {
        Tenant tenant = new("acme-gmbh", "Acme GmbH");

        Assert.True(tenant.IsActive);
        Assert.Equal("acme-gmbh", tenant.Slug);
        Assert.Null(tenant.CountryCode);
        Assert.Null(tenant.RegionCode);
    }

    [Fact]
    public void Profile_update_normalizes_country_and_region()
    {
        Tenant tenant = new("acme-gmbh", "Acme GmbH");

        tenant.UpdateProfile("Acme Saarland GmbH", "de", "de-sl");

        Assert.Equal("Acme Saarland GmbH", tenant.Name);
        Assert.Equal("DE", tenant.CountryCode);
        Assert.Equal("DE-SL", tenant.RegionCode);
    }

    [Fact]
    public void Profile_update_clears_optional_location_fields()
    {
        Tenant tenant = new("acme-gmbh", "Acme GmbH");
        tenant.UpdateProfile("Acme GmbH", "DE", "DE-SL");

        tenant.UpdateProfile("Acme GmbH", null, null);

        Assert.Null(tenant.CountryCode);
        Assert.Null(tenant.RegionCode);
    }

    [Theory]
    [InlineData("DEU")]
    [InlineData("D")]
    [InlineData("1E")]
    public void Invalid_country_codes_are_rejected(string countryCode)
    {
        Tenant tenant = new("acme-gmbh", "Acme GmbH");

        DomainRuleException exception = Assert.Throws<DomainRuleException>(
            () => tenant.UpdateProfile("Acme GmbH", countryCode, null));

        Assert.Equal("tenant.country_code_invalid", exception.Code);
    }

    [Fact]
    public void Region_without_country_is_rejected()
    {
        Tenant tenant = new("acme-gmbh", "Acme GmbH");

        DomainRuleException exception = Assert.Throws<DomainRuleException>(
            () => tenant.UpdateProfile("Acme GmbH", null, "DE-SL"));

        Assert.Equal("tenant.region_requires_country", exception.Code);
    }

    [Fact]
    public void Region_outside_the_selected_country_is_rejected()
    {
        Tenant tenant = new("acme-gmbh", "Acme GmbH");

        DomainRuleException exception = Assert.Throws<DomainRuleException>(
            () => tenant.UpdateProfile("Acme GmbH", "DE", "AT-9"));

        Assert.Equal("tenant.region_code_invalid", exception.Code);
    }

    [Fact]
    public void Deactivate_marks_the_tenant_inactive()
    {
        Tenant tenant = new("acme-gmbh", "Acme GmbH");

        tenant.Deactivate();

        Assert.False(tenant.IsActive);
    }
}
