using System.Security.Claims;
using System.Threading.RateLimiting;
using FlowPro.Application.Accounts;
using FlowPro.Application.Identity;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;

namespace FlowPro.Api.Authentication;

internal static class AuthenticationExtensions
{
    private const string ModeKey = "Authentication:Mode";
    private const string SessionMode = "Session";

    /// <summary>
    /// FlowPro signs people in itself, with accounts and server-side sessions. The only other mode,
    /// <c>DevelopmentHeaders</c>, exists for automated tests and works only in Development.
    /// </summary>
    public static IServiceCollection AddFlowProAuthentication(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        services.AddTransient<IClaimsTransformation, FlowProClaimsTransformation>();

        // The account handlers are registered in every mode, so their options must be too, or
        // service validation fails at startup.
        services.AddSingleton(
            configuration.GetSection(AccountSessionOptions.SectionName).Get<AccountSessionOptions>()
            ?? new AccountSessionOptions());
        services.AddSingleton(ReadEmailOptions(configuration, environment));
        services.AddSingleton<IAuthenticatorKeyProtector, AuthenticatorKeyProtector>();

        if (IsDevelopmentHeaderMode(configuration))
        {
            if (!environment.IsDevelopment())
            {
                throw new InvalidOperationException(
                    "Authentication:Mode DevelopmentHeaders is only allowed in the Development environment.");
            }

            services
                .AddAuthentication(DevelopmentAuthenticationHandler.SchemeName)
                .AddScheme<AuthenticationSchemeOptions, DevelopmentAuthenticationHandler>(
                    DevelopmentAuthenticationHandler.SchemeName,
                    _ => { });
            return services;
        }

        string mode = configuration[ModeKey] ?? SessionMode;

        if (!string.Equals(mode, SessionMode, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"Authentication:Mode '{mode}' is not supported. Use '{SessionMode}'.");
        }

        services.AddSingleton<SessionCookie>();
        services.AddSingleton<TwoFactorChallengeCookie>();
        services
            .AddAuthentication(SessionAuthenticationHandler.SchemeName)
            .AddScheme<AuthenticationSchemeOptions, SessionAuthenticationHandler>(
                SessionAuthenticationHandler.SchemeName,
                _ => { });
        return services;
    }

    private static AccountEmailOptions ReadEmailOptions(
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        AccountEmailOptions options =
            configuration.GetSection(AccountEmailOptions.SectionName).Get<AccountEmailOptions>()
            ?? new AccountEmailOptions();

        if (options.AppBaseUrl is { } url
            && (!url.IsAbsoluteUri || (url.Scheme != Uri.UriSchemeHttps && url.Scheme != Uri.UriSchemeHttp)))
        {
            throw new InvalidOperationException(
                $"{AccountEmailOptions.SectionName}:AppBaseUrl must be an absolute http or https URL.");
        }

        // Mail without a link is useless, and silently sending none would hide the mistake.
        if (options.AppBaseUrl is null
            && !environment.IsDevelopment()
            && !string.IsNullOrWhiteSpace(configuration["Email:Smtp:Host"]))
        {
            throw new InvalidOperationException(
                $"{AccountEmailOptions.SectionName}:AppBaseUrl must be set when email is configured.");
        }

        return options;
    }

    /// <summary>True unless the development header mode is configured.</summary>
    public static bool IsSessionMode(IConfiguration configuration) =>
        !IsDevelopmentHeaderMode(configuration);

    private static bool IsDevelopmentHeaderMode(IConfiguration configuration) =>
        string.Equals(
            configuration[ModeKey],
            DevelopmentAuthenticationHandler.SchemeName,
            StringComparison.OrdinalIgnoreCase);

    public static IServiceCollection AddFlowProAuthorization(this IServiceCollection services)
    {
        services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();
        services.AddAuthorization(options =>
        {
            foreach (string permission in PermissionKeys.All)
            {
                options.AddPolicy(
                    permission,
                    policy => policy
                        .RequireAuthenticatedUser()
                        .AddRequirements(new PermissionRequirement(permission)));
            }
        });
        return services;
    }

    public static IServiceCollection AddFlowProRateLimiting(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        RateLimitOptions limits = RateLimitOptions.Read(configuration);

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
            {
                string partition = context.User.FindFirstValue(FlowProClaimTypes.UserId)
                    ?? context.Connection.RemoteIpAddress?.ToString()
                    ?? "anonymous";

                return RateLimitPartition.GetFixedWindowLimiter(
                    partition,
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 300,
                        QueueLimit = 20,
                        QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                        Window = TimeSpan.FromMinutes(1),
                    });
            });

            // Workspace claim creates tenants and is reachable by any authenticated identity
            // provider account, so it gets a much tighter budget than the global one. Queuing is
            // disabled: a caller over budget should be told immediately, not held open.
            options.AddPolicy(
                RateLimitPolicies.WorkspaceClaim,
                context => RateLimitPartition.GetFixedWindowLimiter(
                    context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                        ?? context.Connection.RemoteIpAddress?.ToString()
                        ?? "anonymous",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 5,
                        QueueLimit = 0,
                        Window = TimeSpan.FromHours(1),
                    }));

            // Sign-in and registration are the endpoints an attacker hammers, so each client
            // address gets a small budget. Account lockout covers the case of one account being
            // attacked from many addresses.
            options.AddPolicy(
                RateLimitPolicies.SignIn,
                context => RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = limits.SignInPerMinute,
                        QueueLimit = 0,
                        Window = TimeSpan.FromMinutes(1),
                    }));
            // Reset and confirmation requests send email, so they get the registration budget
            // per address: enough for a person who mistyped, too little to flood a mailbox.
            options.AddPolicy(
                RateLimitPolicies.AccountEmail,
                context => RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = limits.AccountEmailPer15Minutes,
                        QueueLimit = 0,
                        Window = TimeSpan.FromMinutes(15),
                    }));
            options.AddPolicy(
                RateLimitPolicies.AccountRegistration,
                context => RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = limits.RegistrationsPerHour,
                        QueueLimit = 0,
                        Window = TimeSpan.FromHours(1),
                    }));
        });
        return services;
    }
}

internal static class RateLimitPolicies
{
    public const string WorkspaceClaim = "workspace-claim";
    public const string SignIn = "sign-in";
    public const string AccountRegistration = "account-registration";
    public const string AccountEmail = "account-email";
}
