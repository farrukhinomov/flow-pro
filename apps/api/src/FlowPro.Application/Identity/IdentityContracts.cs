using FlowPro.Application.Common;

namespace FlowPro.Application.Identity;

public sealed record GetCurrentSessionQuery : IQuery<CurrentSession>;

public sealed record CurrentSession(
    Guid TenantId,
    string TenantSlug,
    string TenantName,
    Guid UserId,
    string ExternalSubject,
    string Email,
    string DisplayName,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Permissions,
    IReadOnlyList<string> ManagedTeams);
