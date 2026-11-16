using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace FlowPro.Infrastructure.Persistence;

public sealed class DesignTimeFlowProDbContextFactory : IDesignTimeDbContextFactory<FlowProDbContext>
{
    public FlowProDbContext CreateDbContext(string[] args)
    {
        string connectionString = Environment.GetEnvironmentVariable("FLOWPRO_DESIGN_CONNECTION")
            ?? "Host=localhost;Port=5432;Database=flowpro;Username=flowpro;Password=superadmin";
        DbContextOptionsBuilder<FlowProDbContext> options = new();
        options.UseNpgsql(
            connectionString,
            npgsql => npgsql.MigrationsHistoryTable(
                "__ef_migrations_history",
                DatabaseSchemas.Infrastructure));

        return new FlowProDbContext(options.Options, TimeProvider.System);
    }
}
