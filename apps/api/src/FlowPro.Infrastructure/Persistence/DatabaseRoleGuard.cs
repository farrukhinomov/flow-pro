using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace FlowPro.Infrastructure.Persistence;

/// <summary>
/// Refuses to run on a database role that PostgreSQL does not hold to tenant isolation.
/// </summary>
/// <remarks>
/// Superusers and roles with <c>BYPASSRLS</c> skip row-level security, so every workspace's rows
/// would be one forgotten filter away from any member. That is easy to set up by accident: the
/// official PostgreSQL image makes <c>POSTGRES_USER</c> a superuser, and managed databases hand out
/// administrator credentials first. Development only warns, so an older local database keeps
/// working until it is recreated.
/// </remarks>
public static partial class DatabaseRoleGuard
{
    public static async Task VerifyAsync(
        IServiceProvider services,
        bool isDevelopment,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(services);

        await using AsyncServiceScope scope = services.CreateAsyncScope();
        FlowProDbContext dbContext = scope.ServiceProvider.GetRequiredService<FlowProDbContext>();
        RoleAttributes role = await dbContext.Database
            .SqlQuery<RoleAttributes>(
                $"""
                SELECT rolname AS "Name", rolsuper AS "IsSuperuser", rolbypassrls AS "BypassesRowSecurity"
                FROM pg_roles
                WHERE rolname = current_user
                """)
            .SingleAsync(cancellationToken);

        if (!role.IsSuperuser && !role.BypassesRowSecurity)
        {
            return;
        }

        if (isDevelopment)
        {
            ILogger logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>()
                .CreateLogger(typeof(DatabaseRoleGuard));
            LogBypass(logger, role.Name);
            return;
        }

        throw new InvalidOperationException(
            $"The database role '{role.Name}' is a superuser or has BYPASSRLS, so PostgreSQL would not "
            + "keep workspaces apart. Connect as an ordinary role that owns the FlowPro database; see "
            + "docs/self-hosting/public-deployment.md.");
    }

    [LoggerMessage(
        Level = LogLevel.Warning,
        Message = "The database role {Role} bypasses row-level security, so workspaces are not isolated. Recreate the local database volume to get the FlowPro role (docker compose down -v).")]
    private static partial void LogBypass(ILogger logger, string role);

    private sealed record RoleAttributes(string Name, bool IsSuperuser, bool BypassesRowSecurity);
}
