namespace FlowPro.Api.Authentication;

/// <summary>
/// Per-address budgets for the endpoints attackers hammer (section <c>RateLimiting</c>).
/// </summary>
/// <remarks>
/// The defaults suit most deployments. Raise them when many people reach FlowPro from one public
/// address, such as an office behind a single NAT, because every one of them shares the budget.
/// Account lockout still limits guessing against any single account.
/// </remarks>
internal sealed class RateLimitOptions
{
    public const string SectionName = "RateLimiting";

    /// <summary>Sign-in, sign-out, password reset and password change requests per minute.</summary>
    public int SignInPerMinute { get; init; } = 10;

    /// <summary>Password-reset and confirmation emails requested per 15 minutes.</summary>
    public int AccountEmailPer15Minutes { get; init; } = 5;

    /// <summary>Account registrations per hour.</summary>
    public int RegistrationsPerHour { get; init; } = 5;

    public static RateLimitOptions Read(IConfiguration configuration)
    {
        RateLimitOptions options =
            configuration.GetSection(SectionName).Get<RateLimitOptions>() ?? new RateLimitOptions();

        if (options.SignInPerMinute < 1
            || options.AccountEmailPer15Minutes < 1
            || options.RegistrationsPerHour < 1)
        {
            throw new InvalidOperationException(
                $"Every {SectionName} limit must be at least 1. Rate limiting cannot be switched off.");
        }

        return options;
    }
}
