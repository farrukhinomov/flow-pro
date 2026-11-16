using System.Text.Json;
using FlowPro.Application.Audit;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Integration;
using FlowPro.Domain.Audit;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Integration;
using FlowPro.Domain.Onboarding;
using FlowPro.Domain.Organization;
using FlowPro.Domain.Tenancy;

namespace FlowPro.Application.Onboarding;

/// <summary>
/// Turns a signed-in account into a FlowPro workspace.
/// </summary>
/// <remarks>
/// This is the only workflow that runs without a tenant in the caller's identity. It generates the
/// tenant identifier up front so the whole transaction can execute inside that tenant's row level
/// security scope, then creates the owner's user and employee records and lets
/// <see cref="WorkspaceProvisioner" /> add what every workspace needs.
/// </remarks>
public sealed class WorkspaceClaimHandler(
    ICurrentPrincipal currentPrincipal,
    IOnboardingRepository repository,
    WorkspaceProvisioner provisioner,
    IAuditWriter auditWriter,
    IOutboxWriter outboxWriter,
    IProvisioningUnitOfWork unitOfWork,
    TimeProvider timeProvider) :
    IQueryHandler<GetWorkspaceClaimStateQuery, WorkspaceClaimState>,
    ICommandHandler<ClaimWorkspaceCommand, WorkspaceClaimResult>
{
    private const int MaxSlugAttempts = 50;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<WorkspaceClaimState> HandleAsync(
        GetWorkspaceClaimStateQuery query,
        CancellationToken cancellationToken)
    {
        PrincipalIdentity principal = currentPrincipal.GetRequiredPrincipal();
        Membership? existing = await repository.FindActiveUserAsync(
            principal,
            cancellationToken);
        string suggestedName = SuggestWorkspaceName(principal);

        return new WorkspaceClaimState(
            existing is not null,
            principal.Email,
            principal.DisplayName,
            suggestedName,
            OnboardingSlug.Create(suggestedName));
    }

    public async Task<WorkspaceClaimResult> HandleAsync(
        ClaimWorkspaceCommand command,
        CancellationToken cancellationToken)
    {
        PrincipalIdentity principal = currentPrincipal.GetRequiredPrincipal();
        string workspaceName = NormalizeWorkspaceName(command.WorkspaceName);

        if (await repository.FindActiveUserAsync(
                principal,
                cancellationToken) is not null)
        {
            throw new FlowProConflictException(
                "onboarding.workspace_already_claimed",
                "This account already belongs to a workspace.");
        }

        string slug = await ReserveSlugAsync(command.Slug ?? workspaceName, cancellationToken);
        Guid tenantId = Guid.CreateVersion7();

        return await unitOfWork.ExecuteInTenantScopeAsync(
            tenantId,
            async transactionCancellationToken =>
            {
                DateTimeOffset now = timeProvider.GetUtcNow();
                Tenant tenant = new(slug, workspaceName, tenantId);

                Membership owner = new(
                    tenantId,
                    principal.ExternalSubject,
                    principal.Email,
                    principal.DisplayName);

                if (principal.AccountId is { } accountId)
                {
                    owner.LinkAccount(accountId);
                }

                repository.AddUser(owner);

                (string givenName, string familyName) = SplitDisplayName(principal.DisplayName);
                Employee employee = new(
                    tenantId,
                    owner.Id,
                    "EMP-001",
                    givenName,
                    familyName);
                repository.AddEmployee(employee);

                await provisioner.ProvisionAsync(tenant, owner.Id, transactionCancellationToken);

                TenantOnboarding onboarding = new(tenantId, owner.Id);
                repository.AddOnboarding(onboarding);

                WorkspaceClaimResult result = new(
                    tenantId,
                    tenant.Slug,
                    tenant.Name,
                    owner.Id,
                    employee.Id,
                    OnboardingMapper.Map(onboarding));

                RecordEvent(
                    tenantId,
                    owner.Id,
                    "onboarding.workspace.claimed.v1",
                    tenantId,
                    new
                    {
                        TenantId = tenantId,
                        tenant.Slug,
                        tenant.Name,
                        OwnerUserId = owner.Id,
                        OwnerEmail = owner.Email,
                    },
                    now);

                return result;
            },
            cancellationToken);
    }

    private async Task<string> ReserveSlugAsync(string source, CancellationToken cancellationToken)
    {
        string baseSlug = OnboardingSlug.Create(source);

        for (int attempt = 0; attempt < MaxSlugAttempts; attempt++)
        {
            string candidate = attempt == 0 ? baseSlug : OnboardingSlug.WithSuffix(baseSlug, attempt + 1);

            if (!await repository.SlugExistsAsync(candidate, cancellationToken))
            {
                return candidate;
            }
        }

        throw new FlowProConflictException(
            "onboarding.slug_unavailable",
            "Could not derive an available workspace address. Choose a different workspace name.");
    }

    private void RecordEvent(
        Guid tenantId,
        Guid actorUserId,
        string eventType,
        Guid aggregateId,
        object payload,
        DateTimeOffset now)
    {
        string payloadJson = JsonSerializer.Serialize(payload, JsonOptions);

        outboxWriter.Add(
            new OutboxMessage(tenantId, eventType, "onboarding", aggregateId, payloadJson, now));
        auditWriter.Add(
            new AuditEvent(tenantId, actorUserId, eventType, "onboarding", aggregateId, payloadJson, now));
    }

    private static string NormalizeWorkspaceName(string workspaceName)
    {
        string normalized = workspaceName?.Trim() ?? string.Empty;

        if (normalized.Length < 2)
        {
            throw new FlowProValidationException(
                "onboarding.workspace_name_required",
                "A workspace name of at least 2 characters is required.");
        }

        if (normalized.Length > 200)
        {
            throw new FlowProValidationException(
                "onboarding.workspace_name_too_long",
                "A workspace name cannot exceed 200 characters.");
        }

        return normalized;
    }

    private static string SuggestWorkspaceName(PrincipalIdentity principal)
    {
        string? emailDomain = principal.Email.Split('@', StringSplitOptions.RemoveEmptyEntries)
            .Skip(1)
            .FirstOrDefault();

        if (string.IsNullOrWhiteSpace(emailDomain) || IsConsumerDomain(emailDomain))
        {
            string displayName = principal.DisplayName.Trim();
            return displayName.Length >= 2 ? $"{displayName} Workspace" : "My Workspace";
        }

        string organization = emailDomain.Split('.')[0];

        return organization.Length >= 2
            ? char.ToUpperInvariant(organization[0]) + organization[1..]
            : "My Workspace";
    }

    private static bool IsConsumerDomain(string domain) =>
        OnboardingDefaults.ConsumerEmailDomains.Contains(domain.ToLowerInvariant());

    private static (string GivenName, string FamilyName) SplitDisplayName(string displayName)
    {
        string[] parts = displayName.Split(' ', StringSplitOptions.RemoveEmptyEntries);

        return parts.Length switch
        {
            0 => ("New", "Member"),
            1 => (parts[0], parts[0]),
            _ => (string.Join(' ', parts[..^1]), parts[^1]),
        };
    }
}
