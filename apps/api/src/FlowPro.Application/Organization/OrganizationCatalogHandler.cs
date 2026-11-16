using System.Text.Json;
using FlowPro.Application.Audit;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Integration;
using FlowPro.Domain.Audit;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Integration;
using FlowPro.Domain.Organization;

namespace FlowPro.Application.Organization;

public sealed class OrganizationCatalogHandler(
    ICurrentRequestContext requestContext,
    IPermissionChecker permissionChecker,
    IOrganizationCatalogRepository repository,
    IOutboxWriter outboxWriter,
    IAuditWriter auditWriter,
    IUnitOfWork unitOfWork,
    TimeProvider timeProvider) :
    IQueryHandler<ListOrganizationCatalogQuery, OrganizationCatalogPage>,
    ICommandHandler<SaveOrganizationCatalogRecordCommand, OrganizationCatalogRecordDto>,
    ICommandHandler<SetManagerDelegationsCommand, ManagerDelegationPage>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<OrganizationCatalogPage> HandleAsync(
        ListOrganizationCatalogQuery query,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        await RequireOrganizationManageAsync(identity, cancellationToken);

        OrganizationCatalogSnapshot snapshot = await repository.LoadAsync(
            identity.TenantId,
            cancellationToken);

        return new OrganizationCatalogPage(
            [
                .. snapshot.Departments.Select(MapDepartment),
                .. snapshot.Locations.Select(MapLocation),
                .. snapshot.RoleProfiles.Select(MapRoleProfile),
                .. snapshot.Teams.Select(MapTeam),
                .. snapshot.WorkPatterns.Select(MapWorkPattern),
            ],
            snapshot.Delegations.Select(MapDelegation).ToArray());
    }

    public async Task<OrganizationCatalogRecordDto> HandleAsync(
        SaveOrganizationCatalogRecordCommand command,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        await RequireOrganizationManageAsync(identity, cancellationToken);

        return await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                OrganizationCatalogRecordDto saved = command.Record.Kind switch
                {
                    "department" => await SaveDepartmentAsync(
                        identity.TenantId,
                        command.Record,
                        transactionCancellationToken),
                    "location" => await SaveLocationAsync(
                        identity.TenantId,
                        command.Record,
                        transactionCancellationToken),
                    "role-profile" => await SaveRoleProfileAsync(
                        identity.TenantId,
                        command.Record,
                        transactionCancellationToken),
                    "team" => await SaveTeamAsync(
                        identity.TenantId,
                        command.Record,
                        transactionCancellationToken),
                    "work-pattern" => await SaveWorkPatternAsync(
                        identity.TenantId,
                        command.Record,
                        transactionCancellationToken),
                    _ => throw new FlowProValidationException(
                        "organization_catalog.unsupported_kind",
                        "Unsupported organization catalog kind."),
                };

                AddAuditAndOutbox(identity, saved.Id, "organization.catalog.saved.v1", saved);
                return saved;
            },
            cancellationToken);
    }

    public async Task<ManagerDelegationPage> HandleAsync(
        SetManagerDelegationsCommand command,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        await RequireOrganizationManageAsync(identity, cancellationToken);

        return await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                Membership manager = await repository.FindUserByExternalIdAsync(
                        identity.TenantId,
                        command.ManagerId,
                        transactionCancellationToken)
                    ?? throw new FlowProNotFoundException(
                        "manager.not_found",
                        "Manager was not found.");
                OrganizationCatalogSnapshot snapshot = await repository.LoadAsync(
                    identity.TenantId,
                    transactionCancellationToken);
                Dictionary<string, Team> teamsByName = snapshot.Teams
                    .Select(item => item.Team)
                    .ToDictionary(team => team.Name, StringComparer.OrdinalIgnoreCase);
                Dictionary<Guid, Team> teamsById = snapshot.Teams
                    .Select(item => item.Team)
                    .ToDictionary(team => team.Id);
                HashSet<Guid> selectedTeamIds = [];

                foreach (string teamName in command.Teams.Where(team => !string.IsNullOrWhiteSpace(team)))
                {
                    if (!teamsByName.TryGetValue(teamName, out Team? team))
                    {
                        throw new FlowProNotFoundException(
                            "team.not_found",
                            $"Team '{teamName}' was not found.");
                    }

                    selectedTeamIds.Add(team.Id);
                }

                IReadOnlyList<ManagerDelegation> existing = await repository.ListManagerDelegationsAsync(
                    identity.TenantId,
                    manager.Id,
                    transactionCancellationToken);
                List<ManagerDelegation> added = [];

                foreach (ManagerDelegation delegation in existing)
                {
                    if (selectedTeamIds.Contains(delegation.TeamId))
                    {
                        delegation.Activate();
                    }
                    else
                    {
                        delegation.Deactivate();
                    }
                }

                foreach (Guid teamId in selectedTeamIds.Where(teamId => existing.All(item => item.TeamId != teamId)))
                {
                    ManagerDelegation delegation = new(identity.TenantId, manager.Id, teamId);
                    repository.AddManagerDelegation(delegation);
                    added.Add(delegation);
                }

                AddAuditAndOutbox(
                    identity,
                    command.ManagerId,
                    "organization.manager_delegations.updated.v1",
                    new { command.ManagerId, command.Teams });

                return new ManagerDelegationPage(
                    existing
                        .Concat(added)
                        .Where(item => teamsById.ContainsKey(item.TeamId))
                        .Select(item => MapDelegation(new ManagerDelegationProjection(
                            item,
                            manager,
                            teamsById[item.TeamId])))
                        .ToArray());
            },
            cancellationToken);
    }

    private async Task<OrganizationCatalogRecordDto> SaveRoleProfileAsync(
        Guid tenantId,
        OrganizationCatalogRecordDto record,
        CancellationToken cancellationToken)
    {
        RoleProfile? profile = await repository.FindRoleProfileAsync(
            tenantId,
            record.Id,
            cancellationToken);
        bool isActive = record.Status != "archived";

        if (profile is null)
        {
            profile = new RoleProfile(
                tenantId,
                record.Id,
                Required(record.Label, "label"),
                Required(record.BaseRole, "baseRole"),
                record.Description,
                isActive);
            repository.AddRoleProfile(profile);
        }
        else
        {
            profile.Update(
                Required(record.Label, "label"),
                Required(record.BaseRole, "baseRole"),
                record.Description,
                isActive);
        }

        return MapRoleProfile(profile);
    }

    private async Task<OrganizationCatalogRecordDto> SaveDepartmentAsync(
        Guid tenantId,
        OrganizationCatalogRecordDto record,
        CancellationToken cancellationToken)
    {
        string code = Required(record.Code, "code");
        string name = Required(record.Name, "name");
        Department? department = await repository.FindDepartmentAsync(
            tenantId,
            record.Id,
            code,
            cancellationToken);

        if (department is null)
        {
            department = new Department(tenantId, code, name);
            repository.AddDepartment(department);
        }
        else
        {
            department.Update(code, name);
        }

        return MapDepartment(department);
    }

    private async Task<OrganizationCatalogRecordDto> SaveLocationAsync(
        Guid tenantId,
        OrganizationCatalogRecordDto record,
        CancellationToken cancellationToken)
    {
        string code = Required(record.Code, "code");
        string name = Required(record.Name, "name");
        string timeZoneId = Required(record.TimeZoneId, "timeZoneId");
        Location? location = await repository.FindLocationAsync(
            tenantId,
            record.Id,
            code,
            cancellationToken);

        if (location is null)
        {
            location = new Location(tenantId, code, name, timeZoneId);
            repository.AddLocation(location);
        }
        else
        {
            location.Update(code, name, timeZoneId);
        }

        return MapLocation(location);
    }

    private async Task<OrganizationCatalogRecordDto> SaveTeamAsync(
        Guid tenantId,
        OrganizationCatalogRecordDto record,
        CancellationToken cancellationToken)
    {
        string name = Required(record.Name, "name");
        Team? team = await repository.FindTeamAsync(tenantId, record.Id, name, cancellationToken);
        Membership? manager = string.IsNullOrWhiteSpace(record.ManagerId)
            ? null
            : await repository.FindUserByExternalIdAsync(
                tenantId,
                record.ManagerId,
                cancellationToken);
        string code = SlugCode(name);

        if (team is null)
        {
            team = new Team(
                tenantId,
                null,
                code,
                name,
                externalId: record.Id,
                managerUserId: manager?.Id);
            repository.AddTeam(team);
        }
        else
        {
            team.Update(null, code, name, record.Id, manager?.Id);
        }

        return MapTeam(new TeamProjection(team, manager));
    }

    private async Task<OrganizationCatalogRecordDto> SaveWorkPatternAsync(
        Guid tenantId,
        OrganizationCatalogRecordDto record,
        CancellationToken cancellationToken)
    {
        WorkPattern? pattern = await repository.FindWorkPatternAsync(
            tenantId,
            record.Id,
            cancellationToken);
        int weeklyMinutes = (int)Math.Round((record.WeeklyHours ?? 0) * 60);
        bool isActive = record.Status != "archived";

        if (pattern is null)
        {
            pattern = new WorkPattern(
                tenantId,
                record.Id,
                Required(record.Label, "label"),
                weeklyMinutes,
                record.Description,
                isActive);
            repository.AddWorkPattern(pattern);
        }
        else
        {
            pattern.Update(
                Required(record.Label, "label"),
                weeklyMinutes,
                record.Description,
                isActive);
        }

        return MapWorkPattern(pattern);
    }

    private async Task RequireOrganizationManageAsync(
        RequestIdentity identity,
        CancellationToken cancellationToken)
    {
        bool allowed = await permissionChecker.HasPermissionAsync(
            identity.TenantId,
            identity.UserId,
            PermissionKeys.OrganizationManage,
            cancellationToken);

        if (!allowed)
        {
            throw new FlowProForbiddenException(
                "organization.manage_required",
                "Managing organization catalogs requires the organization.manage permission.");
        }
    }

    private void AddAuditAndOutbox(RequestIdentity identity, string aggregateId, string eventType, object payload)
    {
        DateTimeOffset now = timeProvider.GetUtcNow();
        string payloadJson = JsonSerializer.Serialize(payload, JsonOptions);
        Guid stableId = StableGuid($"organization:{aggregateId}");

        outboxWriter.Add(
            new OutboxMessage(
                identity.TenantId,
                eventType,
                "organization-catalog",
                stableId,
                payloadJson,
                now));
        auditWriter.Add(
            new AuditEvent(
                identity.TenantId,
                identity.UserId,
                eventType,
                "organization-catalog",
                stableId,
                payloadJson,
                now));
    }

    private static OrganizationCatalogRecordDto MapRoleProfile(RoleProfile profile) =>
        new(
            profile.ExternalId,
            "role-profile",
            null,
            profile.Label,
            null,
            profile.Description,
            profile.IsActive ? "active" : "archived",
            profile.BaseRole,
            null,
            null,
            null,
            profile.CreatedAt,
            profile.UpdatedAt);

    private static OrganizationCatalogRecordDto MapTeam(TeamProjection projection) =>
        new(
            projection.Team.ExternalId,
            "team",
            projection.Team.Code,
            null,
            projection.Team.Name,
            null,
            "active",
            null,
            projection.Manager?.ExternalSubject,
            null,
            null,
            projection.Team.CreatedAt,
            projection.Team.UpdatedAt);

    private static OrganizationCatalogRecordDto MapWorkPattern(WorkPattern pattern) =>
        new(
            pattern.ExternalId,
            "work-pattern",
            null,
            pattern.Label,
            null,
            pattern.Description,
            pattern.IsActive ? "active" : "archived",
            null,
            null,
            null,
            pattern.WeeklyMinutes / 60d,
            pattern.CreatedAt,
            pattern.UpdatedAt);

    private static OrganizationCatalogRecordDto MapDepartment(Department department) =>
        new(
            $"department-{department.Code.ToLowerInvariant()}",
            "department",
            department.Code,
            null,
            department.Name,
            null,
            "active",
            null,
            null,
            null,
            null,
            department.CreatedAt,
            department.UpdatedAt);

    private static OrganizationCatalogRecordDto MapLocation(Location location) =>
        new(
            $"location-{location.Code.ToLowerInvariant()}",
            "location",
            location.Code,
            null,
            location.Name,
            null,
            "active",
            null,
            null,
            location.TimeZoneId,
            null,
            location.CreatedAt,
            location.UpdatedAt);

    private static ManagerDelegationDto MapDelegation(ManagerDelegationProjection projection) =>
        new(
            $"delegation-{projection.Manager.ExternalSubject}-{SlugCode(projection.Team.Name).ToLowerInvariant()}",
            projection.Manager.ExternalSubject,
            projection.Team.Name,
            projection.Delegation.IsActive,
            projection.Delegation.CreatedAt,
            projection.Delegation.UpdatedAt);

    private static string Required(string? value, string name)
    {
        string normalized = value?.Trim() ?? string.Empty;
        if (normalized.Length == 0)
        {
            throw new FlowProValidationException(
                "organization_catalog.required",
                $"{name} is required.");
        }

        return normalized;
    }

    private static string SlugCode(string value)
    {
        string code = new(
            value.Trim()
                .Select(character => char.IsLetterOrDigit(character) ? char.ToUpperInvariant(character) : '-')
                .ToArray());
        string normalized = string.Join('-', code.Split('-', StringSplitOptions.RemoveEmptyEntries));
        return normalized.Length > 50 ? normalized[..50] : normalized;
    }

    private static Guid StableGuid(string value)
    {
        byte[] hash = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(value));
        Span<byte> bytes = stackalloc byte[16];
        hash.AsSpan(0, 16).CopyTo(bytes);
        return new Guid(bytes);
    }
}
