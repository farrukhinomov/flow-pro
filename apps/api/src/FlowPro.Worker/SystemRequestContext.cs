using FlowPro.Application.Common;

namespace FlowPro.Worker;

/// <summary>
/// Request context for background processing.
/// </summary>
/// <remarks>
/// Background work runs outside any authenticated request, so there is no ambient tenant to scope
/// row level security to. Jobs that must be tenant scoped take the tenant identifier explicitly and
/// use <see cref="IProvisioningUnitOfWork" />, the same way workspace provisioning does.
/// </remarks>
internal sealed class SystemRequestContext : ICurrentRequestContext
{
    public RequestIdentity GetRequiredIdentity() =>
        throw new InvalidOperationException("Background work runs without a request identity.");

    public RequestIdentity? TryGetIdentity() => null;
}
