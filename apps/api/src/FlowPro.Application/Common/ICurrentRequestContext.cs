namespace FlowPro.Application.Common;

public interface ICurrentRequestContext
{
    RequestIdentity GetRequiredIdentity();

    RequestIdentity? TryGetIdentity();
}
