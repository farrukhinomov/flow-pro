using FlowPro.Application.Common;
using FlowPro.Application.Demo;
using FlowPro.Application.Onboarding;
using FlowPro.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace FlowPro.Worker;

public static class WorkerServiceRegistration
{
    public static IServiceCollection AddFlowProWorker(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddScoped<ICurrentRequestContext, SystemRequestContext>();
        services.AddFlowProInfrastructure(configuration);
        services.AddHostedService<OutboxWorker>();

        services.AddScoped<WorkspaceProvisioner>();
        services.AddScoped<DemoReset>();
        services.AddHostedService<DemoResetWorker>();

        return services;
    }
}
