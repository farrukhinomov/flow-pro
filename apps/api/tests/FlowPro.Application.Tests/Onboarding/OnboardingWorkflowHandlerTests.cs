using FlowPro.Application.Common;
using FlowPro.Application.Onboarding;
using FlowPro.Domain.Common;
using FlowPro.Domain.Onboarding;
using FlowPro.Domain.Organization;
using FlowPro.Domain.Tenancy;

namespace FlowPro.Application.Tests.Onboarding;

public sealed class OnboardingWorkflowHandlerTests
{
    private static readonly Guid TenantId = Guid.Parse("01975fa8-7590-7000-8000-000000006001");
    private static readonly Guid UserId = Guid.Parse("01975fa8-7590-7000-8000-000000006002");
    private static readonly DateTimeOffset Now = new(2026, 7, 30, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task State_reports_progress_for_a_workspace_in_setup()
    {
        TestFixture fixture = new();
        fixture.Seed();

        OnboardingStateDto state = await fixture.Handler.HandleAsync(
            new GetOnboardingStateQuery(),
            CancellationToken.None);

        Assert.Equal("in-progress", state.Status);
        Assert.Equal("company", state.CurrentStep);
        Assert.Equal(
            ["company", "team", "absences", "first-clock-in"],
            state.Steps.Select(step => step.Step));
        Assert.All(state.Steps, step => Assert.False(step.Resolved));
    }

    [Fact]
    public async Task Workspaces_created_before_the_wizard_existed_are_treated_as_set_up()
    {
        TestFixture fixture = new();

        OnboardingStateDto state = await fixture.Handler.HandleAsync(
            new GetOnboardingStateQuery(),
            CancellationToken.None);

        Assert.Equal("completed", state.Status);
        Assert.Null(state.CurrentStep);
        Assert.All(state.Steps, step => Assert.True(step.Resolved));
    }

    [Fact]
    public async Task Company_step_updates_the_tenant_profile_location_and_work_pattern()
    {
        TestFixture fixture = new();
        fixture.Seed();

        CompanyProfileDto result = await fixture.Handler.HandleAsync(
            new SaveCompanyProfileCommand("Acme Saarland GmbH", "DE", "DE-SL", "Europe/Berlin", 38.5m),
            CancellationToken.None);

        Tenant tenant = Assert.Single(fixture.Repository.Tenants);
        Location location = Assert.Single(fixture.Repository.Locations);
        WorkPattern workPattern = Assert.Single(
            fixture.Repository.WorkPatterns,
            pattern => pattern.ExternalId == OnboardingDefaults.DefaultWorkPatternExternalId);

        Assert.Equal("Acme Saarland GmbH", tenant.Name);
        Assert.Equal("DE", tenant.CountryCode);
        Assert.Equal("DE-SL", tenant.RegionCode);
        Assert.Equal("Europe/Berlin", location.TimeZoneId);
        Assert.Equal(2_310, workPattern.WeeklyMinutes);
        Assert.Equal(38.5m, result.WeeklyHours);
        Assert.Equal("team", result.Onboarding.CurrentStep);
    }

    [Fact]
    public async Task Company_step_creates_the_default_location_when_missing()
    {
        TestFixture fixture = new();
        fixture.Seed(withLocation: false, withWorkPattern: false);

        await fixture.Handler.HandleAsync(
            new SaveCompanyProfileCommand("Acme GmbH", "DE", null, "Europe/Berlin", 40m),
            CancellationToken.None);

        Location location = Assert.Single(fixture.Repository.Locations);

        Assert.Equal(OnboardingDefaults.DefaultLocationCode, location.Code);
        Assert.Equal("Europe/Berlin", location.TimeZoneId);
        Assert.Equal(
            2_400,
            Assert.Single(fixture.Repository.WorkPatterns).WeeklyMinutes);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(0.5)]
    [InlineData(61)]
    [InlineData(200)]
    public async Task Weekly_hours_outside_the_legal_range_are_rejected(double weeklyHours)
    {
        TestFixture fixture = new();
        fixture.Seed();

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.Handler.HandleAsync(
                new SaveCompanyProfileCommand(
                    "Acme GmbH",
                    "DE",
                    null,
                    "Europe/Berlin",
                    (decimal)weeklyHours),
                CancellationToken.None));

        Assert.Equal("onboarding.weekly_hours_invalid", exception.Code);
    }

    [Fact]
    public async Task Unknown_time_zones_are_rejected()
    {
        TestFixture fixture = new();
        fixture.Seed();

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.Handler.HandleAsync(
                new SaveCompanyProfileCommand("Acme GmbH", "DE", null, "Mars/Olympus", 40m),
                CancellationToken.None));

        Assert.Equal("onboarding.time_zone_invalid", exception.Code);
    }

    [Fact]
    public async Task Steps_can_be_skipped_and_are_recorded_as_such()
    {
        TestFixture fixture = new();
        fixture.Seed();

        OnboardingStateDto state = await fixture.Handler.HandleAsync(
            new ResolveOnboardingStepCommand(OnboardingStep.Team, Skipped: true),
            CancellationToken.None);

        OnboardingStepDto teamStep = state.Steps.Single(step => step.Step == "team");

        Assert.True(teamStep.Resolved);
        Assert.True(teamStep.Skipped);
        Assert.Single(fixture.Audit.Events, item => item.Action == "onboarding.step.skipped.v1");
    }

    [Fact]
    public async Task Completing_finishes_setup_and_writes_an_audit_record()
    {
        TestFixture fixture = new();
        fixture.Seed();

        OnboardingStateDto state = await fixture.Handler.HandleAsync(
            new CompleteOnboardingCommand(),
            CancellationToken.None);

        Assert.Equal("completed", state.Status);
        Assert.Equal(Now, state.CompletedAt);
        Assert.Single(fixture.Audit.Events, item => item.Action == "onboarding.completed.v1");
        Assert.Single(fixture.Outbox.Messages, item => item.EventType == "onboarding.completed.v1");
    }

    [Fact]
    public async Task Steps_cannot_be_changed_once_setup_is_complete()
    {
        TestFixture fixture = new();
        fixture.Seed();
        await fixture.Handler.HandleAsync(new CompleteOnboardingCommand(), CancellationToken.None);

        await Assert.ThrowsAsync<DomainRuleException>(
            () => fixture.Handler.HandleAsync(
                new ResolveOnboardingStepCommand(OnboardingStep.Team),
                CancellationToken.None));
    }

    [Fact]
    public async Task Writing_a_step_without_a_setup_record_is_a_not_found()
    {
        TestFixture fixture = new();

        FlowProNotFoundException exception = await Assert.ThrowsAsync<FlowProNotFoundException>(
            () => fixture.Handler.HandleAsync(
                new ResolveOnboardingStepCommand(OnboardingStep.Team),
                CancellationToken.None));

        Assert.Equal("onboarding.not_found", exception.Code);
    }

    private sealed class TestFixture
    {
        public TestFixture()
        {
            Repository = new FakeOnboardingRepository();
            Audit = new FakeOnboardingAuditWriter();
            Outbox = new FakeOnboardingOutbox();
            Handler = new OnboardingWorkflowHandler(
                new FakeOnboardingRequestContext(TenantId, UserId),
                Repository,
                Audit,
                Outbox,
                new FakeOnboardingUnitOfWork(),
                new FixedOnboardingTimeProvider(Now));
        }

        public OnboardingWorkflowHandler Handler { get; }

        public FakeOnboardingRepository Repository { get; }

        public FakeOnboardingAuditWriter Audit { get; }

        public FakeOnboardingOutbox Outbox { get; }

        public void Seed(bool withLocation = true, bool withWorkPattern = true)
        {
            Repository.Tenants.Add(new Tenant("acme-gmbh", "Acme GmbH", TenantId));
            Repository.Onboardings.Add(new TenantOnboarding(TenantId, UserId));

            if (withLocation)
            {
                Repository.Locations.Add(
                    new Location(
                        TenantId,
                        OnboardingDefaults.DefaultLocationCode,
                        "Headquarters",
                        "Europe/Berlin"));
            }

            if (withWorkPattern)
            {
                Repository.WorkPatterns.Add(
                    new WorkPattern(
                        TenantId,
                        OnboardingDefaults.DefaultWorkPatternExternalId,
                        "Standard week",
                        OnboardingDefaults.DefaultWeeklyMinutes,
                        "Default weekly working time for the workspace.",
                        isActive: true));
            }
        }
    }
}
