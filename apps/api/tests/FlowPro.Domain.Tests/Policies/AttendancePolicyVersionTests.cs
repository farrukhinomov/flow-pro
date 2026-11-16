using FlowPro.Domain.Policies;

namespace FlowPro.Domain.Tests.Policies;

public sealed class AttendancePolicyVersionTests
{
    private static readonly Guid TenantId = Guid.CreateVersion7();
    private static readonly Guid ActorId = Guid.CreateVersion7();
    private static readonly DateTimeOffset PublishedAt = new(2025, 12, 15, 9, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset EffectiveFrom = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

    private static AttendancePolicyVersion CreateVersion(
        DateTimeOffset? effectiveFrom = null) =>
        new(
            TenantId,
            "default",
            1,
            """{"id":"default"}""",
            ActorId,
            PublishedAt,
            effectiveFrom ?? EffectiveFrom);

    [Fact]
    public void Publish_date_and_effective_date_are_independent()
    {
        // The whole point of the field: rules agreed in December that apply
        // from January.
        AttendancePolicyVersion version = CreateVersion();

        Assert.Equal(PublishedAt, version.PublishedAt);
        Assert.Equal(EffectiveFrom, version.EffectiveFrom);
        Assert.NotEqual(version.PublishedAt, version.EffectiveFrom);
    }

    [Fact]
    public void New_version_is_the_latest_published()
    {
        Assert.True(CreateVersion().IsCurrent);
    }

    [Fact]
    public void Superseding_clears_the_latest_published_flag()
    {
        AttendancePolicyVersion version = CreateVersion();

        version.Supersede();

        Assert.False(version.IsCurrent);
    }

    [Fact]
    public void Does_not_govern_before_its_effective_date()
    {
        AttendancePolicyVersion version = CreateVersion();

        Assert.False(version.GovernsAt(EffectiveFrom.AddTicks(-1)));
        Assert.False(version.GovernsAt(PublishedAt));
    }

    [Fact]
    public void Governs_from_the_effective_instant_inclusive()
    {
        // A policy effective from midnight on 1 January governs work booked at
        // midnight on 1 January.
        AttendancePolicyVersion version = CreateVersion();

        Assert.True(version.GovernsAt(EffectiveFrom));
        Assert.True(version.GovernsAt(EffectiveFrom.AddDays(30)));
    }

    [Fact]
    public void A_scheduled_version_is_published_but_not_yet_governing()
    {
        // This is the case the IsCurrent flag alone cannot express, and the
        // reason reads resolve by effective date instead.
        AttendancePolicyVersion scheduled = CreateVersion(PublishedAt.AddMonths(1));

        Assert.True(scheduled.IsCurrent);
        Assert.False(scheduled.GovernsAt(PublishedAt));
    }
}
