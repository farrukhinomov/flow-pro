using FlowPro.Application.Common;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Tenancy;
using FlowPro.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Testcontainers.PostgreSql;

namespace FlowPro.Infrastructure.Tests.Persistence;

/// <summary>
/// Tenant isolation is enforced by PostgreSQL itself, so it is tested against PostgreSQL: a member
/// sees and writes only their own workspace, even through a query that forgets to filter.
/// </summary>
public sealed class TenantIsolationTests(TenantIsolationTests.Database database)
    : IClassFixture<TenantIsolationTests.Database>
{
    private static readonly Guid TenantA = new("0a000000-0000-4000-8000-00000000000a");
    private static readonly Guid TenantB = new("0b000000-0000-4000-8000-00000000000b");

    [Fact]
    public async Task Every_tenant_table_forces_the_isolation_policy()
    {
        await using NpgsqlConnection connection = new(database.ConnectionString);
        await connection.OpenAsync();
        await using NpgsqlCommand command = new(
            """
            SELECT n.nspname || '.' || c.relname
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind = 'r'
              AND (
                  EXISTS (
                      SELECT 1 FROM pg_attribute a
                      WHERE a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped)
                  OR (n.nspname = 'tenancy' AND c.relname = 'tenants'))
              AND NOT (
                  c.relrowsecurity
                  AND c.relforcerowsecurity
                  AND EXISTS (
                      SELECT 1 FROM pg_policies p
                      WHERE p.schemaname = n.nspname
                        AND p.tablename = c.relname
                        AND p.policyname = 'tenant_isolation'))
            ORDER BY 1
            """,
            connection);

        List<string> unprotected = [];
        await using (NpgsqlDataReader reader = await command.ExecuteReaderAsync())
        {
            while (await reader.ReadAsync())
            {
                unprotected.Add(reader.GetString(0));
            }
        }

        // A new tenant-owned table needs the policy in its migration, see EnforceTenantRowLevelSecurity.
        Assert.Empty(unprotected);
    }

    [Fact]
    public async Task A_member_sees_only_their_own_workspace_even_without_a_filter()
    {
        await using AsyncServiceScope scope = database.ScopeFor(TenantA);
        FlowProDbContext dbContext = scope.ServiceProvider.GetRequiredService<FlowProDbContext>();

        Assert.Equal([TenantA], await dbContext.Tenants.Select(tenant => tenant.Id).ToListAsync());
        Assert.Equal([TenantA], await dbContext.Users.Select(user => user.TenantId).Distinct().ToListAsync());
    }

    [Fact]
    public async Task Without_a_member_tenant_tables_look_empty()
    {
        await using AsyncServiceScope scope = database.ScopeFor(tenantId: null);
        FlowProDbContext dbContext = scope.ServiceProvider.GetRequiredService<FlowProDbContext>();

        Assert.Equal(0, await dbContext.Tenants.CountAsync());
        Assert.Equal(0, await dbContext.Users.CountAsync());
    }

    [Fact]
    public async Task Writing_into_another_workspace_is_refused()
    {
        await using AsyncServiceScope scope = database.ScopeFor(TenantA);
        FlowProDbContext dbContext = scope.ServiceProvider.GetRequiredService<FlowProDbContext>();

        dbContext.Users.Add(new Membership(TenantB, "intruder", "intruder@example.com", "Intruder"));

        DbUpdateException refused = await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());
        Assert.Equal(
            PostgresErrorCodes.InsufficientPrivilege,
            Assert.IsType<PostgresException>(refused.InnerException).SqlState);
    }

    [Fact]
    public async Task The_cross_tenant_scope_sees_every_workspace_and_ends_with_the_call()
    {
        await using AsyncServiceScope scope = database.ScopeFor(TenantA);
        FlowProDbContext dbContext = scope.ServiceProvider.GetRequiredService<FlowProDbContext>();

        int across = await dbContext.AcrossTenantsAsync(
            () => dbContext.Tenants.CountAsync(),
            CancellationToken.None);

        Assert.Equal(2, across);
        Assert.Equal(1, await dbContext.Tenants.CountAsync());
    }

    [Fact]
    public async Task A_pooled_connection_does_not_carry_the_previous_member_s_workspace()
    {
        await using (AsyncServiceScope first = database.ScopeFor(TenantB))
        {
            FlowProDbContext dbContext = first.ServiceProvider.GetRequiredService<FlowProDbContext>();
            Assert.Equal(1, await dbContext.Tenants.CountAsync());
        }

        await using AsyncServiceScope second = database.ScopeFor(tenantId: null);
        FlowProDbContext anonymous = second.ServiceProvider.GetRequiredService<FlowProDbContext>();

        Assert.Equal(0, await anonymous.Tenants.CountAsync());
    }

    [Fact]
    public async Task The_application_role_passes_the_startup_check()
    {
        await DatabaseRoleGuard.VerifyAsync(database.Services, isDevelopment: false, CancellationToken.None);
    }

    [Fact]
    public async Task A_superuser_connection_is_refused_at_startup()
    {
        await using ServiceProvider superuser = Database.BuildServices(database.SuperuserConnectionString);

        InvalidOperationException refused = await Assert.ThrowsAsync<InvalidOperationException>(
            () => DatabaseRoleGuard.VerifyAsync(superuser, isDevelopment: false, CancellationToken.None));
        Assert.Contains("BYPASSRLS", refused.Message, StringComparison.Ordinal);

        // Development only warns, so an older local database keeps working.
        await DatabaseRoleGuard.VerifyAsync(superuser, isDevelopment: true, CancellationToken.None);
    }

    /// <summary>
    /// A migrated PostgreSQL with two workspaces, one member each, reached the way the compose
    /// stack reaches it: as an ordinary role that owns the database.
    /// </summary>
    public sealed class Database : IAsyncLifetime
    {
        private const string Role = "flowpro";
        private const string Password = "flowpro-tests";

        // The same major version as compose.yaml.
        private readonly PostgreSqlContainer container = new PostgreSqlBuilder("postgres:18-alpine").Build();

        private ServiceProvider? services;

        /// <summary>The container's administrator, a superuser like <c>POSTGRES_USER</c>.</summary>
        public string SuperuserConnectionString => container.GetConnectionString();

        public string ConnectionString => new NpgsqlConnectionStringBuilder(SuperuserConnectionString)
        {
            Username = Role,
            Password = Password,
            Database = Role,
        }.ConnectionString;

        public IServiceProvider Services => services!;

        public static ServiceProvider BuildServices(string connectionString)
        {
            IConfiguration configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(
                    new Dictionary<string, string?> { ["ConnectionStrings:FlowPro"] = connectionString })
                .Build();
            ServiceCollection collection = new();
            collection.AddLogging();
            collection.AddScoped<TestRequestContext>();
            collection.AddScoped<ICurrentRequestContext>(provider => provider.GetRequiredService<TestRequestContext>());
            collection.AddFlowProInfrastructure(configuration);
            return collection.BuildServiceProvider();
        }

        public async Task InitializeAsync()
        {
            await container.StartAsync();

            // What docker/postgres/initdb does for the compose stack.
            await using (NpgsqlConnection admin = new(SuperuserConnectionString))
            {
                await admin.OpenAsync();
                foreach (string statement in new[]
                {
                    $"CREATE ROLE {Role} LOGIN PASSWORD '{Password}' NOSUPERUSER NOBYPASSRLS NOCREATEROLE",
                    $"CREATE DATABASE {Role} OWNER {Role}",
                })
                {
                    await using NpgsqlCommand command = new(statement, admin);
                    await command.ExecuteNonQueryAsync();
                }
            }

            services = BuildServices(ConnectionString);

            await using AsyncServiceScope scope = ScopeFor(tenantId: null);
            await scope.ServiceProvider.GetRequiredService<DatabaseInitializer>().MigrateAsync(CancellationToken.None);

            FlowProDbContext dbContext = scope.ServiceProvider.GetRequiredService<FlowProDbContext>();
            await dbContext.AcrossTenantsAsync(
                async () =>
                {
                    foreach ((Guid tenantId, string slug) in new[] { (TenantA, "workspace-a"), (TenantB, "workspace-b") })
                    {
                        dbContext.Tenants.Add(new Tenant(slug, slug, tenantId));
                        dbContext.Users.Add(new Membership(tenantId, $"member-{slug}", $"member@{slug}.example", "Member"));
                    }

                    await dbContext.SaveChangesAsync();
                },
                CancellationToken.None);
        }

        public AsyncServiceScope ScopeFor(Guid? tenantId)
        {
            AsyncServiceScope scope = services!.CreateAsyncScope();
            scope.ServiceProvider.GetRequiredService<TestRequestContext>().TenantId = tenantId;
            return scope;
        }

        public async Task DisposeAsync()
        {
            if (services is not null)
            {
                await services.DisposeAsync();
            }

            await container.DisposeAsync();
        }
    }

    private sealed class TestRequestContext : ICurrentRequestContext
    {
        public Guid? TenantId { get; set; }

        public RequestIdentity GetRequiredIdentity() =>
            TryGetIdentity() ?? throw new InvalidOperationException("No member.");

        public RequestIdentity? TryGetIdentity() =>
            TenantId is { } tenantId ? new RequestIdentity(tenantId, Guid.Empty) : null;
    }
}
