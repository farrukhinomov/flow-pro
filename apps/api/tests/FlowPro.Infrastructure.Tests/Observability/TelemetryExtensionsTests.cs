using FlowPro.Infrastructure.Observability;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using OpenTelemetry.Metrics;
using OpenTelemetry.Trace;

namespace FlowPro.Infrastructure.Tests.Observability;

public sealed class TelemetryExtensionsTests
{
    [Fact]
    public void Without_a_collector_address_nothing_is_collected()
    {
        HostApplicationBuilder builder = Host.CreateEmptyApplicationBuilder(new HostApplicationBuilderSettings());

        Assert.Null(builder.AddFlowProTelemetry("flowpro-test"));

        using IHost host = builder.Build();
        Assert.Null(host.Services.GetService<TracerProvider>());
        Assert.Null(host.Services.GetService<MeterProvider>());
    }

    [Fact]
    public void A_collector_address_turns_export_on()
    {
        HostApplicationBuilder builder = Host.CreateEmptyApplicationBuilder(new HostApplicationBuilderSettings());
        builder.Configuration[TelemetryExtensions.OtlpEndpointSetting] = "http://collector.invalid:4317";

        Assert.NotNull(builder.AddFlowProTelemetry("flowpro-test"));

        using IHost host = builder.Build();
        Assert.NotNull(host.Services.GetService<TracerProvider>());
        Assert.NotNull(host.Services.GetService<MeterProvider>());
    }
}
