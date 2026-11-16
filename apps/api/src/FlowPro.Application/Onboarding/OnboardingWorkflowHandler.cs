using System.Text.Json;
using FlowPro.Application.Audit;
using FlowPro.Application.Common;
using FlowPro.Application.Integration;
using FlowPro.Domain.Audit;
using FlowPro.Domain.Integration;
using FlowPro.Domain.Onboarding;
using FlowPro.Domain.Organization;
using FlowPro.Domain.Tenancy;

namespace FlowPro.Application.Onboarding;

/// <summary>
/// Drives the first-run setup wizard for a workspace that has already been claimed.
/// </summary>
/// <remarks>
/// Only the company step owns data outright. The team and absence steps are recorded here but
/// applied through the modules that already own users and attendance policies, so onboarding never
/// becomes a second place where that configuration lives.
/// </remarks>
public sealed class OnboardingWorkflowHandler(
    ICurrentRequestContext requestContext,
    IOnboardingRepository repository,
    IAuditWriter auditWriter,
    IOutboxWriter outboxWriter,
    IUnitOfWork unitOfWork,
    TimeProvider timeProvider) :
    IQueryHandler<GetOnboardingStateQuery, OnboardingStateDto>,
    ICommandHandler<SaveCompanyProfileCommand, CompanyProfileDto>,
    ICommandHandler<ResolveOnboardingStepCommand, OnboardingStateDto>,
    ICommandHandler<CompleteOnboardingCommand, OnboardingStateDto>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<OnboardingStateDto> HandleAsync(
        GetOnboardingStateQuery query,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        TenantOnboarding? onboarding = await repository.FindOnboardingAsync(
            identity.TenantId,
            cancellationToken);

        // Workspaces provisioned before self-serve signup existed never had a wizard to run.
        return onboarding is null
            ? AlreadySetUpState()
            : OnboardingMapper.Map(onboarding);
    }

    public async Task<CompanyProfileDto> HandleAsync(
        SaveCompanyProfileCommand command,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        string companyName = NormalizeCompanyName(command.CompanyName);
        string timeZoneId = NormalizeTimeZoneId(command.TimeZoneId);
        int weeklyMinutes = NormalizeWeeklyMinutes(command.WeeklyHours);

        return await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                DateTimeOffset now = timeProvider.GetUtcNow();
                Tenant tenant = await repository.FindTenantAsync(
                        identity.TenantId,
                        transactionCancellationToken)
                    ?? throw new FlowProNotFoundException(
                        "onboarding.workspace_not_found",
                        "Workspace was not found.");
                TenantOnboarding onboarding = await RequireOnboardingAsync(
                    identity.TenantId,
                    transactionCancellationToken);

                tenant.UpdateProfile(companyName, command.CountryCode, command.RegionCode);

                await ApplyDefaultLocationAsync(
                    identity.TenantId,
                    companyName,
                    timeZoneId,
                    transactionCancellationToken);
                await ApplyDefaultWorkPatternAsync(
                    identity.TenantId,
                    weeklyMinutes,
                    transactionCancellationToken);

                onboarding.ResolveStep(OnboardingStep.Company, skipped: false, now);

                CompanyProfileDto result = new(
                    tenant.Name,
                    tenant.CountryCode,
                    tenant.RegionCode,
                    timeZoneId,
                    decimal.Round(weeklyMinutes / 60m, 2),
                    OnboardingMapper.Map(onboarding));

                RecordEvent(
                    identity,
                    "onboarding.company.saved.v1",
                    onboarding.Id,
                    result,
                    now);

                return result;
            },
            cancellationToken);
    }

    public async Task<OnboardingStateDto> HandleAsync(
        ResolveOnboardingStepCommand command,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();

        return await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                DateTimeOffset now = timeProvider.GetUtcNow();
                TenantOnboarding onboarding = await RequireOnboardingAsync(
                    identity.TenantId,
                    transactionCancellationToken);

                onboarding.ResolveStep(command.Step, command.Skipped, now);
                OnboardingStateDto state = OnboardingMapper.Map(onboarding);

                RecordEvent(
                    identity,
                    command.Skipped
                        ? "onboarding.step.skipped.v1"
                        : "onboarding.step.completed.v1",
                    onboarding.Id,
                    new
                    {
                        Step = OnboardingDefaults.ToWireFormat(command.Step),
                        command.Skipped,
                    },
                    now);

                return state;
            },
            cancellationToken);
    }

    public async Task<OnboardingStateDto> HandleAsync(
        CompleteOnboardingCommand command,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();

        return await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                DateTimeOffset now = timeProvider.GetUtcNow();
                TenantOnboarding onboarding = await RequireOnboardingAsync(
                    identity.TenantId,
                    transactionCancellationToken);

                onboarding.Complete(now);
                OnboardingStateDto state = OnboardingMapper.Map(onboarding);

                RecordEvent(identity, "onboarding.completed.v1", onboarding.Id, state, now);

                return state;
            },
            cancellationToken);
    }

    private async Task ApplyDefaultLocationAsync(
        Guid tenantId,
        string companyName,
        string timeZoneId,
        CancellationToken cancellationToken)
    {
        Location? location = await repository.FindLocationByCodeAsync(
            tenantId,
            OnboardingDefaults.DefaultLocationCode,
            cancellationToken);

        if (location is null)
        {
            repository.AddLocation(
                new Location(
                    tenantId,
                    OnboardingDefaults.DefaultLocationCode,
                    companyName,
                    timeZoneId));
            return;
        }

        location.Update(OnboardingDefaults.DefaultLocationCode, companyName, timeZoneId);
    }

    private async Task ApplyDefaultWorkPatternAsync(
        Guid tenantId,
        int weeklyMinutes,
        CancellationToken cancellationToken)
    {
        WorkPattern? workPattern = await repository.FindWorkPatternByExternalIdAsync(
            tenantId,
            OnboardingDefaults.DefaultWorkPatternExternalId,
            cancellationToken);

        if (workPattern is null)
        {
            repository.AddWorkPattern(
                new WorkPattern(
                    tenantId,
                    OnboardingDefaults.DefaultWorkPatternExternalId,
                    "Standard week",
                    weeklyMinutes,
                    "Default weekly working time for the workspace.",
                    isActive: true));
            return;
        }

        workPattern.Update(
            workPattern.Label,
            weeklyMinutes,
            workPattern.Description,
            isActive: true);
    }

    private async Task<TenantOnboarding> RequireOnboardingAsync(
        Guid tenantId,
        CancellationToken cancellationToken) =>
        await repository.FindOnboardingAsync(tenantId, cancellationToken)
        ?? throw new FlowProNotFoundException(
            "onboarding.not_found",
            "This workspace has no setup in progress.");

    private void RecordEvent(
        RequestIdentity identity,
        string eventType,
        Guid aggregateId,
        object payload,
        DateTimeOffset now)
    {
        string payloadJson = JsonSerializer.Serialize(payload, JsonOptions);

        outboxWriter.Add(
            new OutboxMessage(
                identity.TenantId,
                eventType,
                "onboarding",
                aggregateId,
                payloadJson,
                now));
        auditWriter.Add(
            new AuditEvent(
                identity.TenantId,
                identity.UserId,
                eventType,
                "onboarding",
                aggregateId,
                payloadJson,
                now));
    }

    private static OnboardingStateDto AlreadySetUpState() =>
        new(
            "completed",
            null,
            TenantOnboarding.AllSteps
                .Select(step => new OnboardingStepDto(
                    OnboardingDefaults.ToWireFormat(step),
                    Resolved: true,
                    Skipped: true,
                    ResolvedAt: null))
                .ToArray(),
            CompletedAt: null);

    private static string NormalizeCompanyName(string companyName)
    {
        string normalized = companyName?.Trim() ?? string.Empty;

        if (normalized.Length < 2 || normalized.Length > 200)
        {
            throw new FlowProValidationException(
                "onboarding.company_name_invalid",
                "A company name between 2 and 200 characters is required.");
        }

        return normalized;
    }

    private static string NormalizeTimeZoneId(string timeZoneId)
    {
        string normalized = timeZoneId?.Trim() ?? string.Empty;

        if (normalized.Length == 0 || !TimeZoneInfo.TryFindSystemTimeZoneById(normalized, out _))
        {
            throw new FlowProValidationException(
                "onboarding.time_zone_invalid",
                "A valid IANA time zone identifier is required.");
        }

        return normalized;
    }

    private static int NormalizeWeeklyMinutes(decimal weeklyHours)
    {
        if (weeklyHours < OnboardingDefaults.MinWeeklyHours
            || weeklyHours > OnboardingDefaults.MaxWeeklyHours)
        {
            throw new FlowProValidationException(
                "onboarding.weekly_hours_invalid",
                $"Weekly hours must be between {OnboardingDefaults.MinWeeklyHours} and "
                + $"{OnboardingDefaults.MaxWeeklyHours}.");
        }

        return (int)Math.Round(weeklyHours * 60m, MidpointRounding.AwayFromZero);
    }
}
