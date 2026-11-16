using FlowPro.Infrastructure.Persistence;
using FlowPro.Worker;

HostApplicationBuilder builder = Host.CreateApplicationBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole();
builder.Services.AddFlowProWorker(builder.Configuration);

IHost host = builder.Build();
await DatabaseRoleGuard.VerifyAsync(host.Services, builder.Environment.IsDevelopment(), CancellationToken.None);
await host.RunAsync();
