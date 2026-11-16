using System.Security.Cryptography.X509Certificates;
using Microsoft.AspNetCore.DataProtection;

namespace FlowPro.Api.Authentication;

internal static class DataProtectionExtensions
{
    public static IServiceCollection AddFlowProDataProtection(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        FlowProDataProtectionOptions options = configuration
            .GetSection(FlowProDataProtectionOptions.SectionName)
            .Get<FlowProDataProtectionOptions>()
            ?? new FlowProDataProtectionOptions();

        IDataProtectionBuilder builder = services
            .AddDataProtection()
            .SetApplicationName(options.ApplicationName);

        if (!string.IsNullOrWhiteSpace(options.KeysDirectory))
        {
            DirectoryInfo keysDirectory = Directory.CreateDirectory(options.KeysDirectory);
            builder.PersistKeysToFileSystem(keysDirectory);
        }

        if (!string.IsNullOrWhiteSpace(options.CertificatePath))
        {
            builder.ProtectKeysWithCertificate(
                X509CertificateLoader.LoadPkcs12FromFile(
                    options.CertificatePath,
                    options.CertificatePassword,
                    X509KeyStorageFlags.EphemeralKeySet));
        }

        return services;
    }
}

internal sealed class FlowProDataProtectionOptions
{
    public const string SectionName = "DataProtection";

    public string ApplicationName { get; init; } = "FlowPro";

    public string? KeysDirectory { get; init; }

    public string? CertificatePath { get; init; }

    public string? CertificatePassword { get; init; }
}
