using FlowPro.Application.Policies;
using FlowPro.Domain.Policies;
using FlowPro.Domain.Sync;
using FlowPro.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Infrastructure.Policies;

internal sealed class AttendancePolicyWorkflowRepository(FlowProDbContext dbContext)
    : IAttendancePolicyWorkflowRepository
{
    public Task<AttendancePolicyVersion?> FindCurrentAsync(
        Guid tenantId,
        string policyId,
        CancellationToken cancellationToken) =>
        dbContext.AttendancePolicyVersions.SingleOrDefaultAsync(
            policy => policy.TenantId == tenantId
                && policy.PolicyId == policyId
                && policy.IsCurrent,
            cancellationToken);

    /// <summary>
    /// Latest revision whose effective date has arrived.
    /// </summary>
    /// <remarks>
    /// Ordered by effective date then version number, so two revisions sharing
    /// an effective instant resolve to the one published later rather than to
    /// whichever the database happens to return first.
    /// </remarks>
    public Task<AttendancePolicyVersion?> FindEffectiveAsync(
        Guid tenantId,
        string policyId,
        DateTimeOffset at,
        CancellationToken cancellationToken) =>
        dbContext.AttendancePolicyVersions
            .Where(policy => policy.TenantId == tenantId
                && policy.PolicyId == policyId
                && policy.EffectiveFrom <= at)
            .OrderByDescending(policy => policy.EffectiveFrom)
            .ThenByDescending(policy => policy.VersionNumber)
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<AttendancePolicyVersion>> ListVersionsAsync(
        Guid tenantId,
        string policyId,
        CancellationToken cancellationToken) =>
        await dbContext.AttendancePolicyVersions
            .Where(policy => policy.TenantId == tenantId && policy.PolicyId == policyId)
            .OrderByDescending(policy => policy.EffectiveFrom)
            .ThenByDescending(policy => policy.VersionNumber)
            .ToArrayAsync(cancellationToken);

    public async Task<int> GetNextVersionNumberAsync(
        Guid tenantId,
        string policyId,
        CancellationToken cancellationToken)
    {
        int? currentMax = await dbContext.AttendancePolicyVersions
            .Where(policy => policy.TenantId == tenantId && policy.PolicyId == policyId)
            .MaxAsync(policy => (int?)policy.VersionNumber, cancellationToken);

        return (currentMax ?? 0) + 1;
    }

    public Task<ClientAggregate?> FindCompatibilityAggregateAsync(
        Guid tenantId,
        string policyId,
        CancellationToken cancellationToken) =>
        dbContext.ClientAggregates.SingleOrDefaultAsync(
            aggregate => aggregate.TenantId == tenantId
                && aggregate.AggregateType == "attendance-policy"
                && aggregate.AggregateId == policyId,
            cancellationToken);

    public void AddVersion(AttendancePolicyVersion version) =>
        dbContext.AttendancePolicyVersions.Add(version);

    public void AddCompatibilityAggregate(ClientAggregate aggregate) =>
        dbContext.ClientAggregates.Add(aggregate);
}
