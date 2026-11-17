using System.Reflection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using OpenTelemetry;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace FlowPro.Infrastructure.Observability;

/// <summary>
/// OpenTelemetry traces, metrics and logs, sent over OTLP to a collector the operator runs. Off
/// unless <c>OTEL_EXPORTER_OTLP_ENDPOINT</c> is set: nothing is collected or sent by default.
/// The standard <c>OTEL_*</c> variables, such as the protocol and headers, configure the exporter.
/// </summary>
public static class TelemetryExtensions
{
    public const string OtlpEndpointSetting = "OTEL_EXPORTER_OTLP_ENDPOINT";

    public static bool IsTelemetryExportEnabled(IConfiguration configuration) =>
        !string.IsNullOrWhiteSpace(configuration[OtlpEndpointSetting]);

    /// <summary>
    /// Registers telemetry shared by the API and the worker, or returns <see langword="null"/>
    /// when export is off, so callers add their own instrumentation only when it is on.
    /// </summary>
    public static OpenTelemetryBuilder? AddFlowProTelemetry(this IHostApplicationBuilder builder, string serviceName)
    {
        ArgumentNullException.ThrowIfNull(builder);
        ArgumentException.ThrowIfNullOrWhiteSpace(serviceName);

        if (!IsTelemetryExportEnabled(builder.Configuration))
        {
            return null;
        }

        string? serviceVersion = Assembly.GetEntryAssembly()?
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
            .InformationalVersion;

        OpenTelemetryBuilder telemetry = builder.Services.AddOpenTelemetry()
            .ConfigureResource(resource => resource
                .AddService(serviceName, serviceVersion: serviceVersion)
                .AddAttributes([new("deployment.environment.name", builder.Environment.EnvironmentName)]))
            .WithTracing(tracing => tracing
                .AddHttpClientInstrumentation()
                // Npgsql's own instrumentation: one span per command, with the SQL text but never
                // parameter values.
                .AddSource("Npgsql"))
            .WithMetrics(metrics => metrics
                .AddHttpClientInstrumentation()
                .AddMeter("Npgsql")
                .AddMeter("System.Runtime"))
            .WithLogging();
        telemetry.UseOtlpExporter();

        return telemetry;
    }
}
