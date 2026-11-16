using FlowPro.Domain.Policies;
using FlowPro.Domain.Sync;

namespace FlowPro.Application.Policies;

public interface IAttendancePolicyWorkflowRepository
{
    /// <summary>
    /// The most recently published revision, whether or not it is in effect yet.
    /// </summary>
    /// <remarks>
    /// Used by the publish path for supersede bookkeeping. Reads that need
    /// "what applies" use <see cref="FindEffectiveAsync"/>, because a revision
    /// scheduled for next month is the latest published one while a different
    /// revision still governs today.
    /// </remarks>
    Task<AttendancePolicyVersion?> FindCurrentAsync(
        Guid tenantId,
        string policyId,
        CancellationToken cancellationToken);

    /// <summary>The revision governing <paramref name="at"/>, if any.</summary>
    Task<AttendancePolicyVersion?> FindEffectiveAsync(
        Guid tenantId,
        string policyId,
        DateTimeOffset at,
        CancellationToken cancellationToken);

    /// <summary>Every revision, newest effective date first.</summary>
    Task<IReadOnlyList<AttendancePolicyVersion>> ListVersionsAsync(
        Guid tenantId,
        string policyId,
        CancellationToken cancellationToken);

    Task<int> GetNextVersionNumberAsync(
        Guid tenantId,
        string policyId,
        CancellationToken cancellationToken);

    Task<ClientAggregate?> FindCompatibilityAggregateAsync(
        Guid tenantId,
        string policyId,
        CancellationToken cancellationToken);

    void AddVersion(AttendancePolicyVersion version);

    void AddCompatibilityAggregate(ClientAggregate aggregate);
}
