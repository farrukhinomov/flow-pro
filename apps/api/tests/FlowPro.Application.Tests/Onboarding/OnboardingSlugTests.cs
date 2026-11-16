using FlowPro.Application.Onboarding;
using FlowPro.Domain.Tenancy;

namespace FlowPro.Application.Tests.Onboarding;

public sealed class OnboardingSlugTests
{
    [Theory]
    [InlineData("Acme GmbH", "acme-gmbh")]
    [InlineData("  Acme   GmbH  ", "acme-gmbh")]
    [InlineData("Müller & Söhne", "mueller-soehne")]
    [InlineData("Straßenbau AG", "strassenbau-ag")]
    [InlineData("FlowPro", "flowpro")]
    [InlineData("A.B.C.", "a-b-c")]
    [InlineData("2026 Ventures", "2026-ventures")]
    [InlineData("---", "workspace")]
    [InlineData("", "workspace")]
    [InlineData("上海公司", "workspace")]
    public void Slugs_are_derived_from_free_text(string source, string expected) =>
        Assert.Equal(expected, OnboardingSlug.Create(source));

    [Fact]
    public void Slugs_are_capped_at_the_tenant_slug_length()
    {
        string slug = OnboardingSlug.Create(new string('a', 200));

        Assert.Equal(80, slug.Length);
    }

    [Fact]
    public void Suffixed_slugs_stay_within_the_length_limit()
    {
        string baseSlug = OnboardingSlug.Create(new string('a', 200));

        string suffixed = OnboardingSlug.WithSuffix(baseSlug, 12);

        Assert.Equal(80, suffixed.Length);
        Assert.EndsWith("-12", suffixed, StringComparison.Ordinal);
    }

    /// <summary>
    /// Every derived slug must satisfy the tenant invariant, otherwise provisioning would fail
    /// after the user has already committed to a name.
    /// </summary>
    [Theory]
    [InlineData("Acme GmbH")]
    [InlineData("Müller & Söhne")]
    [InlineData("---")]
    [InlineData("上海公司")]
    [InlineData("9")]
    public void Derived_slugs_are_accepted_by_the_tenant_aggregate(string source)
    {
        Tenant tenant = new(OnboardingSlug.Create(source), "Example");

        Assert.Equal(OnboardingSlug.Create(source), tenant.Slug);
    }
}
