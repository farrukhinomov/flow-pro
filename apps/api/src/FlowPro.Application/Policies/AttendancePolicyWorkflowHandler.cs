using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using FlowPro.Application.Audit;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Integration;
using FlowPro.Domain.Audit;
using FlowPro.Domain.Integration;
using FlowPro.Domain.Policies;
using FlowPro.Domain.Sync;

namespace FlowPro.Application.Policies;

public sealed class AttendancePolicyWorkflowHandler(
    ICurrentRequestContext requestContext,
    IPermissionChecker permissionChecker,
    IAttendancePolicyWorkflowRepository repository,
    IOutboxWriter outboxWriter,
    IAuditWriter auditWriter,
    IUnitOfWork unitOfWork,
    TimeProvider timeProvider) :
    IQueryHandler<GetAttendancePolicyConfigQuery, JsonElement?>,
    IQueryHandler<GetAttendancePolicyHistoryQuery, IReadOnlyList<AttendancePolicyVersionDto>>,
    ICommandHandler<PublishAttendancePolicyConfigCommand, JsonElement>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<JsonElement?> HandleAsync(
        GetAttendancePolicyConfigQuery query,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        // Resolved by effective date rather than by the latest-published flag,
        // so a revision scheduled for a future date does not take over the
        // rules that govern today.
        AttendancePolicyVersion? effective = await repository.FindEffectiveAsync(
            identity.TenantId,
            NormalizePolicyId(query.PolicyId),
            query.At ?? timeProvider.GetUtcNow(),
            cancellationToken);

        return effective is null ? null : ToJsonElement(effective.ConfigJson);
    }

    public async Task<IReadOnlyList<AttendancePolicyVersionDto>> HandleAsync(
        GetAttendancePolicyHistoryQuery query,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        // Reading policy history is an audit action, so it needs the same
        // permission as changing a policy rather than plain authentication.
        await RequirePolicyManageAsync(identity, cancellationToken);

        DateTimeOffset now = timeProvider.GetUtcNow();
        IReadOnlyList<AttendancePolicyVersion> versions = await repository.ListVersionsAsync(
            identity.TenantId,
            NormalizePolicyId(query.PolicyId),
            cancellationToken);
        AttendancePolicyVersion? inEffect = versions
            .Where(version => version.GovernsAt(now))
            .OrderByDescending(version => version.EffectiveFrom)
            .ThenByDescending(version => version.VersionNumber)
            .FirstOrDefault();

        return versions
            .Select(version => new AttendancePolicyVersionDto(
                version.Id.ToString(),
                version.PolicyId,
                version.VersionNumber,
                version.PublishedAt,
                version.EffectiveFrom,
                version.IsCurrent,
                version.Id == inEffect?.Id,
                StableHash(version.ConfigJson)))
            .ToArray();
    }

    public async Task<JsonElement> HandleAsync(
        PublishAttendancePolicyConfigCommand command,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        await RequirePolicyManageAsync(identity, cancellationToken);

        return await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                string policyId = NormalizePolicyId(command.PolicyId);
                DateTimeOffset now = timeProvider.GetUtcNow();
                DateTimeOffset effectiveFrom = command.EffectiveFrom ?? now;
                string configJson = NormalizeConfigJson(command.Config, policyId, now);
                AttendancePolicyVersion? current = await repository.FindCurrentAsync(
                    identity.TenantId,
                    policyId,
                    transactionCancellationToken);

                RequireForwardEffectiveDate(current, effectiveFrom);

                // Re-publishing identical rules is a no-op only when the date is
                // unchanged too. Re-dating the same rules is a real change: it
                // moves when they start governing work.
                if (current?.ConfigJson == configJson
                    && current.EffectiveFrom == effectiveFrom)
                {
                    return ToJsonElement(current.ConfigJson);
                }

                current?.Supersede();

                int nextVersion = await repository.GetNextVersionNumberAsync(
                    identity.TenantId,
                    policyId,
                    transactionCancellationToken);
                AttendancePolicyVersion version = new(
                    identity.TenantId,
                    policyId,
                    nextVersion,
                    configJson,
                    identity.UserId,
                    now,
                    effectiveFrom);
                repository.AddVersion(version);

                await UpsertCompatibilityAggregateAsync(
                    identity.TenantId,
                    policyId,
                    configJson,
                    now,
                    transactionCancellationToken);
                AddAuditAndOutbox(identity, version, configJson, now);

                return ToJsonElement(configJson);
            },
            cancellationToken);
    }

    /// <summary>
    /// Rejects a revision dated before the one it replaces.
    /// </summary>
    /// <remarks>
    /// Back-dating behind an existing revision would make history ambiguous:
    /// two revisions would claim the same past period, and a timesheet already
    /// signed under the older rules could silently be re-governed. Correcting
    /// the past is a deliberate act, not something a save should do implicitly.
    /// </remarks>
    private static void RequireForwardEffectiveDate(
        AttendancePolicyVersion? current,
        DateTimeOffset effectiveFrom)
    {
        if (current is null || effectiveFrom >= current.EffectiveFrom)
        {
            return;
        }

        throw new FlowProValidationException(
            "attendance_policy.effective_from_before_current",
            $"Effective date {effectiveFrom:O} is before the current policy's "
                + $"effective date {current.EffectiveFrom:O}.");
    }

    private async Task RequirePolicyManageAsync(
        RequestIdentity identity,
        CancellationToken cancellationToken)
    {
        bool allowed = await permissionChecker.HasPermissionAsync(
            identity.TenantId,
            identity.UserId,
            PermissionKeys.AttendancePolicyManage,
            cancellationToken);

        if (!allowed)
        {
            throw new FlowProForbiddenException(
                "attendance_policy.manage_required",
                "Managing attendance policies requires the attendance-policy.manage permission.");
        }
    }

    private async Task UpsertCompatibilityAggregateAsync(
        Guid tenantId,
        string policyId,
        string configJson,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        ClientAggregate? aggregate = await repository.FindCompatibilityAggregateAsync(
            tenantId,
            policyId,
            cancellationToken);
        string operationId = $"server-attendance-policy-{policyId}-{StableHash(configJson)}";

        if (aggregate is null)
        {
            repository.AddCompatibilityAggregate(
                new ClientAggregate(
                    tenantId,
                    "attendance-policy",
                    policyId,
                    configJson,
                    operationId,
                    now,
                    ownerUserId: null));
            return;
        }

        aggregate.Upsert(configJson, operationId, now);
    }

    private void AddAuditAndOutbox(
        RequestIdentity identity,
        AttendancePolicyVersion version,
        string configJson,
        DateTimeOffset now)
    {
        outboxWriter.Add(
            new OutboxMessage(
                identity.TenantId,
                "attendance_policy.published.v1",
                "attendance-policy",
                version.Id,
                configJson,
                now));
        auditWriter.Add(
            new AuditEvent(
                identity.TenantId,
                identity.UserId,
                "attendance_policy.published.v1",
                "attendance-policy",
                version.Id,
                JsonSerializer.Serialize(
                    new
                    {
                        version.PolicyId,
                        version.VersionNumber,
                        // Recorded because the audit trail must show when the
                        // rules started applying, not only when they were saved.
                        version.EffectiveFrom,
                        ConfigHash = StableHash(configJson),
                    },
                    JsonOptions),
                now));
    }

    private static string NormalizeConfigJson(JsonElement config, string policyId, DateTimeOffset now)
    {
        if (config.ValueKind != JsonValueKind.Object)
        {
            throw new FlowProValidationException(
                "attendance_policy.invalid_config",
                "Attendance policy configuration must be a JSON object.");
        }

        JsonObject document = JsonNode.Parse(config.GetRawText())?.AsObject()
            ?? throw new FlowProValidationException(
                "attendance_policy.invalid_config",
                "Attendance policy configuration must be a JSON object.");

        document["id"] = policyId;
        document["updatedAt"] = now.ToString("O");
        Require(document, "countryCode");
        Require(document, "regionCode");
        Require(document, "defaultWeeklyHours");
        Require(document, "defaultWorkdays");
        Require(document, "vacationAnnualDays");
        Require(document, "vacationCarryover");
        Require(document, "sicknessPrivacyMode");
        Require(document, "legalBreaks");
        Require(document, "periodWindows");
        Require(document, "approvalRules");

        return document.ToJsonString(JsonOptions);
    }

    private static void Require(JsonObject document, string propertyName)
    {
        if (!document.ContainsKey(propertyName) || document[propertyName] is null)
        {
            throw new FlowProValidationException(
                "attendance_policy.required",
                $"{propertyName} is required.");
        }
    }

    private static JsonElement ToJsonElement(string json) =>
        JsonSerializer.Deserialize<JsonElement>(json, JsonOptions);

    private static string NormalizePolicyId(string policyId)
    {
        string normalized = policyId.Trim();
        return normalized.Length == 0 ? "default" : normalized;
    }

    private static string StableHash(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant()[..16];
}
