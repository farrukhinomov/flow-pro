namespace FlowPro.Application.Common;

public abstract class FlowProApplicationException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}

public sealed class FlowProUnauthorizedException()
    : FlowProApplicationException("authentication.required", "Authentication is required.");

/// <summary>The caller tried to authenticate and failed, for example with a wrong password.</summary>
public sealed class FlowProAuthenticationFailedException(string code, string message)
    : FlowProApplicationException(code, message);

public sealed class FlowProForbiddenException(string code, string message)
    : FlowProApplicationException(code, message);

public sealed class FlowProNotFoundException(string code, string message)
    : FlowProApplicationException(code, message);

public sealed class FlowProConflictException(string code, string message)
    : FlowProApplicationException(code, message);

public sealed class FlowProValidationException(string code, string message)
    : FlowProApplicationException(code, message);
