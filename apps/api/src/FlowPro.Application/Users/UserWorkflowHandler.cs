using System.Text.Json;
using FlowPro.Application.Accounts;
using FlowPro.Application.Audit;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Integration;
using FlowPro.Domain.Audit;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Integration;
using FlowPro.Domain.Organization;

namespace FlowPro.Application.Users;

public sealed class UserWorkflowHandler(
    ICurrentRequestContext requestContext,
    IPermissionChecker permissionChecker,
    IUserWorkflowRepository repository,
    IOutboxWriter outboxWriter,
    IAuditWriter auditWriter,
    IUnitOfWork unitOfWork,
    InvitationMailbox invitationMailbox,
    IInvitationTargets invitationTargets,
    SharedAccountPolicy sharedAccounts,
    TimeProvider timeProvider) :
    IQueryHandler<ListUsersQuery, UserDirectoryPage>,
    ICommandHandler<UpsertUserCommand, UserWorkflowResult>,
    ICommandHandler<InviteUserCommand, UserWorkflowResult>,
    ICommandHandler<DeactivateUserCommand, UserWorkflowResult>,
    ICommandHandler<ReactivateUserCommand, UserWorkflowResult>,
    ICommandHandler<ResendInvitationCommand, UserWorkflowResult>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<UserDirectoryPage> HandleAsync(
        ListUsersQuery query,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        bool managesUsers = await permissionChecker.HasPermissionAsync(
            identity.TenantId,
            identity.UserId,
            PermissionKeys.UsersManage,
            cancellationToken);

        // The whole directory needs users.manage. A manager who approves requests also sees the
        // people of the teams they lead, so the approval queue can show whose request it is.
        // Everyone else sees only themselves, which their own timesheet and requests need.
        bool approvesForTeams = !managesUsers
            && await permissionChecker.HasPermissionAsync(
                identity.TenantId,
                identity.UserId,
                PermissionKeys.RequestsApprove,
                cancellationToken);

        IReadOnlyList<UserDirectoryProjection> projections = await repository.ListAsync(
            identity.TenantId,
            cancellationToken);
        UserWorkflowRecord[] users = projections
            .Where(projection => managesUsers
                || projection.User.Id == identity.UserId
                || (approvesForTeams && projection.Team?.ManagerUserId == identity.UserId))
            .Select(Map)
            .Where(user => MatchesFilter(user, query.Filter))
            .ToArray();

        if (query.Page is null)
        {
            return new UserDirectoryPage(users);
        }

        int offset = OffsetCursor.Decode(query.Page.Cursor);
        int limit = query.Page.NormalizedLimit;
        UserWorkflowRecord[] pageItems = users
            .Skip(offset)
            .Take(limit)
            .ToArray();
        int nextOffset = offset + pageItems.Length;
        string? nextCursor = nextOffset < users.Length ? OffsetCursor.Encode(nextOffset) : null;

        return new UserDirectoryPage(pageItems, nextCursor);
    }

    public Task<UserWorkflowResult> HandleAsync(
        UpsertUserCommand command,
        CancellationToken cancellationToken) =>
        SaveUserAsync(command.User, "user.upserted.v1", cancellationToken);

    public Task<UserWorkflowResult> HandleAsync(
        InviteUserCommand command,
        CancellationToken cancellationToken)
    {
        DateTimeOffset now = timeProvider.GetUtcNow();
        string username = command.Email.Split('@')[0].Trim().ToLowerInvariant();
        string[] parts = username.Split('.', StringSplitOptions.RemoveEmptyEntries);
        string firstName = ToNamePart(parts.ElementAtOrDefault(0) ?? "New");
        string lastName = ToNamePart(parts.ElementAtOrDefault(1) ?? "Employee");
        string id = MakeClientUserId(username);

        return SaveUserAsync(
            new UserWorkflowRecord(
                id,
                firstName,
                lastName,
                username,
                command.Email,
                string.Empty,
                UserStatus.Invited,
                NormalizeRole(command.Role),
                $"role-profile-{NormalizeRole(command.Role)}",
                "Unassigned",
                "Unassigned",
                "Not configured",
                VisibilityScopeFor(NormalizeRole(command.Role)),
                null,
                now.AddMonths(3),
                null,
                null,
                command.Note,
                null,
                now,
                now),
            "user.invited.v1",
            cancellationToken,
            sendInvitation: true);
    }

    /// <summary>
    /// Sends a new invitation link to someone who has not signed in to their membership yet. The
    /// previous link stops working.
    /// </summary>
    public async Task<UserWorkflowResult> HandleAsync(
        ResendInvitationCommand command,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        await RequireUsersManageAsync(identity, cancellationToken);

        (UserWorkflowResult result, EmailMessage? invitation) = await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                UserDirectoryProjection projection = await repository.FindProjectionAsync(
                        identity.TenantId,
                        command.UserId,
                        transactionCancellationToken)
                    ?? throw new FlowProNotFoundException(
                        "user.not_found",
                        "User was not found.");

                if (!projection.User.IsOpenForInvitation)
                {
                    throw new FlowProValidationException(
                        "user.invitation_not_open",
                        "This person already signs in, or their access is closed.");
                }

                EmailMessage? message = await PrepareInvitationAsync(
                    identity.TenantId,
                    projection.User,
                    transactionCancellationToken);
                UserWorkflowRecord user = Map(projection);
                AddAuditAndOutbox(identity, projection.User.Id, "user.invitation_sent.v1", user);
                return (new UserWorkflowResult(user), message);
            },
            cancellationToken);

        invitationMailbox.Send(invitation);
        return result;
    }

    public async Task<UserWorkflowResult> HandleAsync(
        DeactivateUserCommand command,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        await RequireUsersManageAsync(identity, cancellationToken);

        return await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                UserDirectoryProjection projection = await repository.FindProjectionAsync(
                        identity.TenantId,
                        command.UserId,
                        transactionCancellationToken)
                    ?? throw new FlowProNotFoundException(
                        "user.not_found",
                        "User was not found.");

                sharedAccounts.EnsureMembershipCanChange(projection.User.AccountId);
                projection.User.Deactivate();
                projection.Employee.UpdateProfile(
                    projection.Employee.PersonnelNumber,
                    projection.Employee.GivenName,
                    projection.Employee.FamilyName,
                    projection.Employee.TeamId,
                    projection.Employee.DepartmentId,
                    projection.Employee.PrimaryLocationId,
                    isActive: false);

                UserWorkflowRecord user = Map(projection) with
                {
                    DeactivatedAt = timeProvider.GetUtcNow(),
                    DeactivatedBy = identity.UserId.ToString(),
                    DeactivationReason = command.Reason,
                    RetentionUntil = timeProvider.GetUtcNow().AddYears(10),
                };

                AddAuditAndOutbox(identity, projection.User.Id, "user.deactivated.v1", user);
                return new UserWorkflowResult(user);
            },
            cancellationToken);
    }

    public async Task<UserWorkflowResult> HandleAsync(
        ReactivateUserCommand command,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        await RequireUsersManageAsync(identity, cancellationToken);

        return await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                UserDirectoryProjection projection = await repository.FindProjectionAsync(
                        identity.TenantId,
                        command.UserId,
                        transactionCancellationToken)
                    ?? throw new FlowProNotFoundException(
                        "user.not_found",
                        "User was not found.");

                projection.User.Reactivate();
                projection.Employee.UpdateProfile(
                    projection.Employee.PersonnelNumber,
                    projection.Employee.GivenName,
                    projection.Employee.FamilyName,
                    projection.Employee.TeamId,
                    projection.Employee.DepartmentId,
                    projection.Employee.PrimaryLocationId,
                    isActive: true);

                UserWorkflowRecord user = Map(projection) with
                {
                    DeactivatedAt = null,
                    DeactivatedBy = null,
                    DeactivationReason = null,
                    RetentionUntil = null,
                };

                AddAuditAndOutbox(identity, projection.User.Id, "user.reactivated.v1", user);
                return new UserWorkflowResult(user);
            },
            cancellationToken);
    }

    private async Task<EmailMessage?> PrepareInvitationAsync(
        Guid tenantId,
        Membership membership,
        CancellationToken cancellationToken)
    {
        string workspaceName = await invitationTargets.FindWorkspaceNameAsync(tenantId, cancellationToken)
            ?? throw new FlowProNotFoundException("tenant.not_found", "The workspace was not found.");

        return await invitationMailbox.PrepareAsync(membership, workspaceName, cancellationToken);
    }

    private async Task<UserWorkflowResult> SaveUserAsync(
        UserWorkflowRecord user,
        string eventType,
        CancellationToken cancellationToken,
        bool sendInvitation = false)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        await RequireUsersManageAsync(identity, cancellationToken);

        (UserWorkflowResult result, EmailMessage? invitation) = await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                string roleKey = NormalizeRole(user.Role);
                Role role = await GetOrCreateRoleAsync(
                    identity.TenantId,
                    roleKey,
                    transactionCancellationToken);
                Team? team = await GetOrCreateTeamAsync(
                    identity.TenantId,
                    user.Team,
                    transactionCancellationToken);
                UserDirectoryEntities? existing = await repository.FindEntitiesByClientIdOrEmailAsync(
                    identity.TenantId,
                    user.Id,
                    user.Email,
                    transactionCancellationToken);

                Membership applicationUser;
                Employee employee;
                if (existing is null)
                {
                    applicationUser = new Membership(
                        identity.TenantId,
                        user.Id,
                        user.Email,
                        $"{user.FirstName} {user.LastName}");
                    employee = new Employee(
                        identity.TenantId,
                        applicationUser.Id,
                        BuildPersonnelNumber(user),
                        user.FirstName,
                        user.LastName);
                    repository.AddUser(applicationUser);
                    repository.AddEmployee(employee);
                }
                else
                {
                    sharedAccounts.EnsureMembershipCanChange(existing.User.AccountId);
                    applicationUser = existing.User;
                    employee = existing.Employee;
                    applicationUser.UpdateProfile(
                        user.Id,
                        user.Email,
                        $"{user.FirstName} {user.LastName}");
                }

                if (user.Status == UserStatus.Invited)
                {
                    applicationUser.MarkInvited();
                }
                else if (user.Status == UserStatus.Inactive)
                {
                    applicationUser.Deactivate();
                }
                else if (user.Status == UserStatus.Active)
                {
                    applicationUser.Reactivate();
                }

                employee.UpdateProfile(
                    BuildPersonnelNumber(user),
                    user.FirstName,
                    user.LastName,
                    team?.Id,
                    null,
                    null,
                    user.Status != UserStatus.Inactive && user.Status != UserStatus.Suspended);
                repository.ReplaceUserRole(identity.TenantId, applicationUser.Id, role.Id);

                UserWorkflowRecord saved = user with
                {
                    Id = applicationUser.ExternalSubject,
                    Role = roleKey,
                    RoleProfileId = user.RoleProfileId ?? $"role-profile-{roleKey}",
                    Team = team?.Name ?? user.Team,
                    CreatedAt = applicationUser.CreatedAt == default ? timeProvider.GetUtcNow() : applicationUser.CreatedAt,
                    UpdatedAt = timeProvider.GetUtcNow(),
                };

                AddAuditAndOutbox(identity, applicationUser.Id, eventType, saved);

                // Only someone who has not signed in to this membership yet needs a link.
                EmailMessage? message = sendInvitation && applicationUser.IsOpenForInvitation
                    ? await PrepareInvitationAsync(identity.TenantId, applicationUser, transactionCancellationToken)
                    : null;

                return (new UserWorkflowResult(saved), message);
            },
            cancellationToken);

        invitationMailbox.Send(invitation);
        return result;
    }

    private async Task<Role> GetOrCreateRoleAsync(
        Guid tenantId,
        string key,
        CancellationToken cancellationToken)
    {
        Role? role = await repository.FindRoleByKeyAsync(tenantId, key, cancellationToken);
        if (role is not null)
        {
            return role;
        }

        role = new Role(tenantId, key, ToRoleLabel(key));
        repository.AddRole(role);
        return role;
    }

    private async Task<Team?> GetOrCreateTeamAsync(
        Guid tenantId,
        string name,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(name) || name.Equals("Unassigned", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        Team? team = await repository.FindTeamByNameAsync(tenantId, name, cancellationToken);
        if (team is not null)
        {
            return team;
        }

        team = new Team(tenantId, null, SlugCode(name), name);
        repository.AddTeam(team);
        return team;
    }

    private async Task RequireUsersManageAsync(
        RequestIdentity identity,
        CancellationToken cancellationToken)
    {
        bool allowed = await permissionChecker.HasPermissionAsync(
            identity.TenantId,
            identity.UserId,
            PermissionKeys.UsersManage,
            cancellationToken);

        if (!allowed)
        {
            throw new FlowProForbiddenException(
                "users.manage_required",
                "Managing users requires the users.manage permission.");
        }
    }

    private void AddAuditAndOutbox(
        RequestIdentity identity,
        Guid aggregateId,
        string eventType,
        UserWorkflowRecord user)
    {
        DateTimeOffset now = timeProvider.GetUtcNow();
        string payload = JsonSerializer.Serialize(
            new { user, occurredAt = now },
            JsonOptions);

        outboxWriter.Add(
            new OutboxMessage(
                identity.TenantId,
                eventType,
                "user",
                aggregateId,
                payload,
                now));
        auditWriter.Add(
            new AuditEvent(
                identity.TenantId,
                identity.UserId,
                eventType,
                "user",
                aggregateId,
                payload,
                now));
    }

    private static UserWorkflowRecord Map(UserDirectoryProjection projection)
    {
        string[] displayNameParts = projection.User.DisplayName.Split(
            ' ',
            2,
            StringSplitOptions.RemoveEmptyEntries);
        string firstName = string.IsNullOrWhiteSpace(projection.Employee.GivenName)
            ? displayNameParts.ElementAtOrDefault(0) ?? projection.User.Email
            : projection.Employee.GivenName;
        string lastName = string.IsNullOrWhiteSpace(projection.Employee.FamilyName)
            ? displayNameParts.ElementAtOrDefault(1) ?? string.Empty
            : projection.Employee.FamilyName;
        string role = NormalizeRole(projection.Role?.Key ?? "employee");

        return new UserWorkflowRecord(
            string.IsNullOrWhiteSpace(projection.User.ExternalSubject)
                ? projection.User.Id.ToString()
                : projection.User.ExternalSubject,
            firstName,
            lastName,
            UsernameFromEmail(projection.User.Email),
            projection.User.Email,
            string.Empty,
            projection.User.Status,
            role,
            $"role-profile-{role}",
            projection.Team?.Name ?? "Unassigned",
            "Unassigned",
            "Not configured",
            VisibilityScopeFor(role),
            null,
            null,
            projection.User.Status == UserStatus.Inactive ? projection.User.UpdatedAt : null,
            null,
            null,
            projection.User.Status == UserStatus.Inactive ? projection.User.UpdatedAt.AddYears(10) : null,
            projection.User.CreatedAt,
            projection.User.UpdatedAt,
            projection.User.Id);
    }

    private static bool MatchesFilter(UserWorkflowRecord user, UserDirectoryFilter? filter)
    {
        if (filter is null)
        {
            return true;
        }

        if (filter.Status is UserStatus status && user.Status != status)
        {
            return false;
        }

        if (!string.IsNullOrWhiteSpace(filter.Role)
            && !user.Role.Equals(NormalizeRole(filter.Role), StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (!string.IsNullOrWhiteSpace(filter.Team)
            && !user.Team.Equals(filter.Team.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (string.IsNullOrWhiteSpace(filter.Search))
        {
            return true;
        }

        string search = filter.Search.Trim();
        return user.Id.Contains(search, StringComparison.OrdinalIgnoreCase)
            || user.FirstName.Contains(search, StringComparison.OrdinalIgnoreCase)
            || user.LastName.Contains(search, StringComparison.OrdinalIgnoreCase)
            || user.Username.Contains(search, StringComparison.OrdinalIgnoreCase)
            || user.Email.Contains(search, StringComparison.OrdinalIgnoreCase)
            || user.Team.Contains(search, StringComparison.OrdinalIgnoreCase);
    }

    private static string BuildPersonnelNumber(UserWorkflowRecord user)
    {
        if (user.Id.Length <= 50)
        {
            return user.Id;
        }

        return user.Id[..50];
    }

    private static string MakeClientUserId(string username) => $"usr-{username.Replace('.', '-')}";

    private static string NormalizeRole(string role) =>
        role.Trim().ToLowerInvariant() switch
        {
            "superadmin" => "superadmin",
            "admin" => "admin",
            "hr" => "hr",
            "manager" => "manager",
            _ => "employee",
        };

    private static string SlugCode(string value)
    {
        string slug = new(
            value.Trim()
                .Select(character => char.IsLetterOrDigit(character) ? char.ToUpperInvariant(character) : '-')
                .ToArray());

        return string.Join(
            '-',
            slug.Split('-', StringSplitOptions.RemoveEmptyEntries))[..Math.Min(50, string.Join('-', slug.Split('-', StringSplitOptions.RemoveEmptyEntries)).Length)];
    }

    private static string ToNamePart(string value)
    {
        string trimmed = value.Trim();
        return trimmed.Length == 0
            ? "Employee"
            : char.ToUpperInvariant(trimmed[0]) + trimmed[1..];
    }

    private static string ToRoleLabel(string role) =>
        role switch
        {
            "superadmin" => "Superadmin",
            "admin" => "Admin",
            "hr" => "HR",
            "manager" => "Manager",
            _ => "Employee",
        };

    private static string UsernameFromEmail(string email) =>
        email.Split('@')[0].ToLowerInvariant();

    private static string VisibilityScopeFor(string role) =>
        role switch
        {
            "superadmin" => "Full platform administration",
            "admin" => "Policy and integration administration",
            "hr" => "Request details and audit trail",
            "manager" => "Team planning details",
            _ => "Availability only",
        };
}
