namespace FlowPro.Api.Authentication;

internal static class CorsExtensions
{
    public const string PolicyName = "FlowProClients";

    public static IServiceCollection AddFlowProCors(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        string[] allowedOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];

        services.AddCors(options =>
        {
            options.AddPolicy(
                PolicyName,
                policy =>
                {
                    if (allowedOrigins.Length == 0)
                    {
                        return;
                    }

                    policy
                        .WithOrigins(allowedOrigins)
                        .AllowAnyHeader()
                        .AllowAnyMethod()
                        .AllowCredentials();
                });
        });

        return services;
    }
}
