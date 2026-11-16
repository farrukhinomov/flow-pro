namespace FlowPro.Application.Common;

public sealed record RequestIdentity(Guid TenantId, Guid UserId);
