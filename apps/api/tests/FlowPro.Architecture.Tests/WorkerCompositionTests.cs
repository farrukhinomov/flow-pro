using FlowPro.Application.Common;
using FlowPro.Application.Demo;
using FlowPro.Infrastructure.Integration;
using FlowPro.Worker;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace FlowPro.Architecture.Tests;

/// <summary>
/// Guards the worker composition root against an incomplete service graph.
/// </summary>
/// <remarks>
/// The worker consumes Infrastructure without the Api composition root, so any Infrastructure
/// dependency that is only registered by the Api crashes the worker at host build time. Validating
/// the container here surfaces that in CI instead of in a container restart loop.
/// </remarks>
public sealed class WorkerCompositionTests
{
    [Fact]
    public void Worker_service_graph_is_complete()
    {
        using ServiceProvider provider = BuildWorkerProvider();
        using IServiceScope scope = provider.CreateScope();

        Assert.NotNull(scope.ServiceProvider.GetRequiredService<IUnitOfWork>());
        Assert.NotNull(scope.ServiceProvider.GetRequiredService<IOutboxDispatcher>());
        Assert.NotNull(scope.ServiceProvider.GetRequiredService<DemoReset>());
    }

    [Fact]
    public void Worker_request_context_carries_no_tenant_scope()
    {
        using ServiceProvider provider = BuildWorkerProvider();
        using IServiceScope scope = provider.CreateScope();

        ICurrentRequestContext requestContext =
            scope.ServiceProvider.GetRequiredService<ICurrentRequestContext>();

        Assert.Null(requestContext.TryGetIdentity());
        Assert.Throws<InvalidOperationException>(() => requestContext.GetRequiredIdentity());
    }

    private static ServiceProvider BuildWorkerProvider()
    {
        // No connection is opened while validating, but AddFlowProInfrastructure requires the
        // setting to be present.
        IConfiguration configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:FlowPro"] =
                    "Host=localhost;Database=flowpro;Username=flowpro;Password=flowpro",
            })
            .Build();

        ServiceCollection services = new();
        services.AddLogging();
        services.AddFlowProWorker(configuration);

        return services.BuildServiceProvider(
            new ServiceProviderOptions { ValidateOnBuild = true, ValidateScopes = true });
    }
}
