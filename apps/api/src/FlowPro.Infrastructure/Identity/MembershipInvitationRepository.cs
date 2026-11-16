using FlowPro.Application.Accounts;
using FlowPro.Domain.Identity;
using FlowPro.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Infrastructure.Identity;

internal sealed class MembershipInvitationRepository(FlowProDbContext dbContext)
    : IMembershipInvitationRepository, IInvitationTargets
{
    public void Add(MembershipInvitation invitation) => dbContext.MembershipInvitations.Add(invitation);

    // An invitation link arrives before anyone is signed in to its workspace, so the lookups by
    // token and by the invitation's own keys look across workspaces. Accepting then runs in the
    // invitation's workspace.
    public Task<MembershipInvitation?> FindByHashAsync(string tokenHash, CancellationToken cancellationToken) =>
        dbContext.AcrossTenantsAsync(
            () => dbContext.MembershipInvitations.FirstOrDefaultAsync(
                invitation => invitation.TokenHash == tokenHash,
                cancellationToken),
            cancellationToken);

    public Task RevokeOutstandingAsync(
        Guid tenantId,
        Guid userId,
        DateTimeOffset now,
        CancellationToken cancellationToken) =>
        dbContext.MembershipInvitations
            .Where(invitation => invitation.TenantId == tenantId
                && invitation.UserId == userId
                && invitation.AcceptedAt == null
                && invitation.RevokedAt == null)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(invitation => invitation.RevokedAt, now),
                cancellationToken);

    public async Task<InvitationTarget?> FindAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        // Tracked on purpose: accepting changes the membership. AsNoTracking on either side of the
        // join would apply to the whole query and the change would be silently lost.
        var found = await dbContext.AcrossTenantsAsync(
            () => (
                from user in dbContext.Users
                join tenant in dbContext.Tenants on user.TenantId equals tenant.Id
                where user.TenantId == tenantId && user.Id == userId && tenant.IsActive
                select new { User = user, tenant.Name }
            ).FirstOrDefaultAsync(cancellationToken),
            cancellationToken);

        return found is null ? null : new InvitationTarget(found.User, found.Name);
    }

    public Task<string?> FindWorkspaceNameAsync(Guid tenantId, CancellationToken cancellationToken) =>
        dbContext.AcrossTenantsAsync(
            () => dbContext.Tenants
                .AsNoTracking()
                .Where(tenant => tenant.Id == tenantId)
                .Select(tenant => tenant.Name)
                .FirstOrDefaultAsync(cancellationToken),
            cancellationToken);
}
