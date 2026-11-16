using System.Data.Common;
using FlowPro.Application.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Npgsql;

namespace FlowPro.Infrastructure.Persistence;

/// <summary>
/// Scopes every database connection to the signed-in member's workspace, so the
/// <c>tenant_isolation</c> policies hide every other workspace's rows.
/// </summary>
/// <remarks>
/// The policies compare each row's tenant with the <c>flowpro.tenant_id</c> setting, which this
/// sets whenever the context opens a connection. Without a signed-in member the setting is empty
/// and tenant-owned tables look empty. Code that must span workspaces says so with
/// <see cref="CrossTenantScope.AcrossTenantsAsync{T}" />. Transactions that act for a tenant
/// before anyone is signed in (provisioning, the demo reset) set the tenant themselves.
/// </remarks>
internal sealed class TenantConnectionInterceptor(ICurrentRequestContext? requestContext) : DbConnectionInterceptor
{
    private const string ApplyScope =
        "SELECT set_config('flowpro.tenant_id', @tenant, false), set_config('flowpro.scope', '', false)";

    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
    {
        using DbCommand command = CreateCommand(connection);
        command.ExecuteNonQuery();
    }

    public override async Task ConnectionOpenedAsync(
        DbConnection connection,
        ConnectionEndEventData eventData,
        CancellationToken cancellationToken = default)
    {
        await using DbCommand command = CreateCommand(connection);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private DbCommand CreateCommand(DbConnection connection)
    {
        DbCommand command = connection.CreateCommand();
        command.CommandText = ApplyScope;
        DbParameter tenant = command.CreateParameter();
        tenant.ParameterName = "tenant";
        tenant.Value = requestContext?.TryGetIdentity()?.TenantId.ToString() ?? string.Empty;
        command.Parameters.Add(tenant);
        return command;
    }
}

/// <summary>The explicit way past tenant isolation, for lookups that by nature span workspaces.</summary>
public static class CrossTenantScope
{
    private const string InFailedTransaction = "25P02";

    /// <summary>
    /// Runs <paramref name="query" /> with every workspace's rows visible: finding an account's
    /// memberships at sign-in, resolving an invitation link, the outbox worker. Keep the query
    /// narrow and filter it yourself; nothing else protects these rows.
    /// </summary>
    public static async Task<T> AcrossTenantsAsync<T>(
        this FlowProDbContext dbContext,
        Func<Task<T>> query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        ArgumentNullException.ThrowIfNull(query);

        await dbContext.Database.OpenConnectionAsync(cancellationToken);
        try
        {
            await dbContext.Database.ExecuteSqlRawAsync(
                "SELECT set_config('flowpro.scope', 'cross-tenant', false)",
                cancellationToken);
            return await query();
        }
        finally
        {
            try
            {
                await dbContext.Database.ExecuteSqlRawAsync(
                    "SELECT set_config('flowpro.scope', '', false)",
                    CancellationToken.None);
            }
            catch (PostgresException exception) when (exception.SqlState == InFailedTransaction)
            {
                // The surrounding transaction failed; rolling it back reverts the setting too.
            }

            await dbContext.Database.CloseConnectionAsync();
        }
    }

    /// <summary>
    /// Lets the current transaction see every workspace until it ends, for work that is
    /// cross-tenant by nature and runs in a transaction of its own, such as the outbox worker.
    /// </summary>
    public static Task ActAcrossTenantsInTransactionAsync(
        this FlowProDbContext dbContext,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(dbContext);

        if (dbContext.Database.CurrentTransaction is null)
        {
            throw new InvalidOperationException("Start the transaction first; the scope ends with it.");
        }

        return dbContext.Database.ExecuteSqlRawAsync(
            "SELECT set_config('flowpro.scope', 'cross-tenant', true)",
            cancellationToken);
    }

    /// <inheritdoc cref="AcrossTenantsAsync{T}" />
    public static Task AcrossTenantsAsync(
        this FlowProDbContext dbContext,
        Func<Task> work,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(work);

        return dbContext.AcrossTenantsAsync(
            async () =>
            {
                await work();
                return true;
            },
            cancellationToken);
    }
}
