using System.Text.Json;
using System.Text.Json.Serialization;
using FlowPro.Api.Attendance;
using FlowPro.Api.Audit;
using FlowPro.Api.Authentication;
using FlowPro.Api.Development;
using FlowPro.Api.Errors;
using FlowPro.Api.Health;
using FlowPro.Api.Identity;
using FlowPro.Api.Modules;
using FlowPro.Api.Notifications;
using FlowPro.Api.Onboarding;
using FlowPro.Api.Operations;
using FlowPro.Api.Organization;
using FlowPro.Api.Payroll;
using FlowPro.Api.Planning;
using FlowPro.Api.Policies;
using FlowPro.Api.Reports;
using FlowPro.Api.Requests;
using FlowPro.Api.Sync;
using FlowPro.Api.Timesheets;
using FlowPro.Api.Users;
using FlowPro.Application;
using FlowPro.Application.Common;
using FlowPro.Infrastructure;
using FlowPro.Infrastructure.Email;
using FlowPro.Infrastructure.Persistence;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using Scalar.AspNetCore;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole();

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddOpenApi("v1");
builder.Services.AddFlowProDataProtection(builder.Configuration);
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentRequestContext, HttpCurrentRequestContext>();
builder.Services.AddScoped<ICurrentPrincipal, HttpCurrentPrincipal>();
builder.Services.AddFlowProApplication();
builder.Services.AddFlowProInfrastructure(builder.Configuration);
builder.Services.AddHostedService<EmailDispatcher>();
builder.Services.AddFlowProAuthentication(builder.Configuration, builder.Environment);
builder.Services.AddFlowProAuthorization();
builder.Services.AddFlowProRateLimiting(builder.Configuration);
builder.Services.AddFlowProCors(builder.Configuration);
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
});
builder.Services.AddHealthChecks()
    .AddCheck<DatabaseHealthCheck>("postgresql", tags: ["ready"]);

WebApplication app = builder.Build();

app.UseExceptionHandler();
app.UseCors(CorsExtensions.PolicyName);
app.UseMiddleware<CrossSiteRequestProtection>();
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi("/openapi/{documentName}.json");
    app.MapScalarApiReference(
        "/scalar",
        options => options
            .WithTitle("FlowPro API")
            .WithOpenApiRoutePattern("/openapi/{documentName}.json"));
    app.MapDevelopmentEndpoints();
}

app.MapGet("/", () => Results.Ok(new
{
    service = "FlowPro API",
    version = typeof(Program).Assembly.GetName().Version?.ToString(),
}));
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false,
});
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
});
app.MapAuthenticationEndpoints();
if (AuthenticationExtensions.IsSessionMode(app.Configuration))
{
    app.MapAccountEndpoints();
    app.MapDemoEndpoints();
}

app.MapAttendanceEndpoints();
app.MapAuditWorkflowEndpoints();
app.MapAttachmentFileEndpoints();
app.MapAttendancePolicyWorkflowEndpoints();
app.MapModuleAggregateEndpoints();
app.MapNotificationWorkflowEndpoints();
app.MapUserPreferencesEndpoints();
app.MapOnboardingEndpoints();
app.MapOperationsHealthEndpoints();
app.MapOrganizationCatalogEndpoints();
app.MapEmploymentContractWorkflowEndpoints();
app.MapPayrollExportArtifactEndpoints();
app.MapPlanningWorkflowEndpoints();
app.MapReportWorkflowEndpoints();
app.MapRequestWorkflowEndpoints();
app.MapSyncEndpoints();
app.MapTimesheetWorkflowEndpoints();
app.MapUserWorkflowEndpoints();

await InitializeDatabaseAsync(app);
await app.RunAsync();

static async Task InitializeDatabaseAsync(WebApplication app)
{
    await using AsyncServiceScope scope = app.Services.CreateAsyncScope();
    IOptions<DatabaseOptions> options = scope.ServiceProvider.GetRequiredService<IOptions<DatabaseOptions>>();

    if (options.Value.ApplyMigrationsOnStartup)
    {
        DatabaseInitializer initializer = scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();
        await initializer.MigrateAsync(CancellationToken.None);

        if (app.Environment.IsDevelopment() && options.Value.SeedDevelopmentData)
        {
            await initializer.SeedDevelopmentDataAsync(CancellationToken.None);
        }
    }

    // After migrating, which creates a missing database in development.
    await DatabaseRoleGuard.VerifyAsync(app.Services, app.Environment.IsDevelopment(), CancellationToken.None);
}

public partial class Program;
