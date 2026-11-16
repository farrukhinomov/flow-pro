namespace FlowPro.Infrastructure.Persistence;

public sealed class DatabaseOptions
{
    public const string SectionName = "Database";

    public bool ApplyMigrationsOnStartup { get; init; }

    public bool SeedDevelopmentData { get; init; }

    /// <summary>
    /// Password given to the seeded development accounts. When empty, no accounts are seeded and
    /// the development data can only be reached with development headers.
    /// </summary>
    public string? DevelopmentAccountPassword { get; init; }
}
