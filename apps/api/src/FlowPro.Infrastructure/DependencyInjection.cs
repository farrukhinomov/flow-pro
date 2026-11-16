using FlowPro.Application.Accounts;
using FlowPro.Application.Attachments;
using FlowPro.Application.Attendance;
using FlowPro.Application.Audit;
using FlowPro.Application.Common;
using FlowPro.Application.Demo;
using FlowPro.Application.Identity;
using FlowPro.Application.Integration;
using FlowPro.Application.Notifications;
using FlowPro.Application.Onboarding;
using FlowPro.Application.Operations;
using FlowPro.Application.Organization;
using FlowPro.Application.Planning;
using FlowPro.Application.Policies;
using FlowPro.Application.Reports;
using FlowPro.Application.Sync;
using FlowPro.Application.Timesheets;
using FlowPro.Application.Users;
using FlowPro.Domain.Identity;
using FlowPro.Infrastructure.Attachments;
using FlowPro.Infrastructure.Attendance;
using FlowPro.Infrastructure.Audit;
using FlowPro.Infrastructure.Demo;
using FlowPro.Infrastructure.Email;
using FlowPro.Infrastructure.Identity;
using FlowPro.Infrastructure.Integration;
using FlowPro.Infrastructure.Notifications;
using FlowPro.Infrastructure.Onboarding;
using FlowPro.Infrastructure.Operations;
using FlowPro.Infrastructure.Organization;
using FlowPro.Infrastructure.Persistence;
using FlowPro.Infrastructure.Planning;
using FlowPro.Infrastructure.Policies;
using FlowPro.Infrastructure.Reports;
using FlowPro.Infrastructure.Sync;
using FlowPro.Infrastructure.Timesheets;
using FlowPro.Infrastructure.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace FlowPro.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddFlowProInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        string connectionString = configuration.GetConnectionString("FlowPro")
            ?? throw new InvalidOperationException("ConnectionStrings:FlowPro is required.");

        services.Configure<DatabaseOptions>(configuration.GetSection(DatabaseOptions.SectionName));
        services.AddSingleton(
            configuration.GetSection(AttachmentOptions.SectionName).Get<AttachmentOptions>()
            ?? new AttachmentOptions());
        services.Configure<AttachmentStorageOptions>(
            configuration.GetSection(AttachmentStorageOptions.SectionName));
        services.AddSingleton(TimeProvider.System);

        // Both hosts need these: the API to protect the shared logins, the worker to reset the demo.
        DemoOptions demo = configuration.GetSection(DemoOptions.SectionName).Get<DemoOptions>() ?? new DemoOptions();
        demo.Validate(configuration.GetValue("Authentication:Session:RegistrationEnabled", defaultValue: true));
        services.AddSingleton(demo);
        services.AddSingleton<SharedAccountPolicy>();
        services.AddScoped<IDemoDatabase, DemoDatabase>();
        services.AddScoped<IDemoAccountWriter, DemoAccountWriter>();
        services.AddScoped<IDemoSampleWriter, DemoSampleWriter>();
        services.AddScoped(provider => new TenantConnectionInterceptor(provider.GetService<ICurrentRequestContext>()));
        services.AddDbContext<FlowProDbContext>(
            (provider, options) =>
            {
                options.AddInterceptors(provider.GetRequiredService<TenantConnectionInterceptor>());
                options.UseNpgsql(
                    connectionString,
                    npgsql =>
                    {
                        npgsql.EnableRetryOnFailure(5, TimeSpan.FromSeconds(2), null);
                        npgsql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
                        npgsql.MigrationsHistoryTable(
                            "__ef_migrations_history",
                            DatabaseSchemas.Infrastructure);
                    });
            });

        services.AddScoped<IUnitOfWork, EfUnitOfWork>();
        services.AddScoped<IProvisioningUnitOfWork, EfProvisioningUnitOfWork>();
        services.AddScoped<IAttachmentObjectStore, LocalAttachmentObjectStore>();
        services.AddScoped<IAttendanceRepository, AttendanceRepository>();
        services.AddScoped<IEmployeeDirectory, EmployeeDirectory>();
        services.AddScoped<IEmploymentContractWorkflowRepository, EmploymentContractWorkflowRepository>();
        services.AddScoped<INotificationWorkflowRepository, NotificationWorkflowRepository>();
        services.AddScoped<IUserPreferencesRepository, UserPreferencesRepository>();
        services.AddScoped<IOnboardingRepository, OnboardingRepository>();
        services.AddScoped<IOperationsHealthRepository, OperationsHealthRepository>();
        services.AddScoped<IOrganizationCatalogRepository, OrganizationCatalogRepository>();
        services.AddScoped<IPlanningWorkflowRepository, PlanningWorkflowRepository>();
        services.AddScoped<IAttendancePolicyWorkflowRepository, AttendancePolicyWorkflowRepository>();
        services.AddScoped<IReportWorkflowRepository, ReportWorkflowRepository>();
        services.AddScoped<IPermissionChecker, PermissionChecker>();
        services.AddScoped<IIdentitySessionRepository, IdentitySessionRepository>();
        services.AddFlowProAccounts();
        services.AddFlowProEmail(configuration);
        services.AddScoped<IAuditEventRepository, AuditEventRepository>();
        services.AddScoped<IAuditWriter, AuditWriter>();
        services.AddScoped<ISyncAggregateRepository, SyncAggregateRepository>();
        services.AddScoped<ITimesheetWorkflowRepository, TimesheetWorkflowRepository>();
        services.AddScoped<IUserWorkflowRepository, UserWorkflowRepository>();
        services.AddScoped<OutboxStore>();
        services.AddScoped<IOutboxWriter>(provider => provider.GetRequiredService<OutboxStore>());
        services.AddScoped<IOutboxReader>(provider => provider.GetRequiredService<OutboxStore>());
        services.AddScoped<IOutboxDispatcher, OutboxDispatcher>();
        services.AddScoped<DatabaseInitializer>();

        return services;
    }

    private static void AddFlowProAccounts(this IServiceCollection services)
    {
        // Identity owns password hashing, password rules and lockout. The rules follow current
        // NIST guidance: length matters, forced character classes do not.
        services
            .AddIdentityCore<Account>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.User.AllowedUserNameCharacters = string.Empty;
                options.Password.RequiredLength = 12;
                options.Password.RequiredUniqueChars = 4;
                options.Password.RequireDigit = false;
                options.Password.RequireLowercase = false;
                options.Password.RequireUppercase = false;
                options.Password.RequireNonAlphanumeric = false;
                options.Lockout.AllowedForNewUsers = true;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            })
            .AddUserStore<AccountStore>();

        services.AddScoped<IAccountCredentials, AccountCredentials>();
        services.AddScoped<AccountSessionRepository>();
        services.AddScoped<IAccountSessionRepository>(
            provider => provider.GetRequiredService<AccountSessionRepository>());
        services.AddScoped<IAccountSecurityLog>(
            provider => provider.GetRequiredService<AccountSessionRepository>());
        services.AddScoped<IAccountTokenRepository>(
            provider => provider.GetRequiredService<AccountSessionRepository>());
        services.AddScoped<IAccountMemberships>(
            provider => provider.GetRequiredService<AccountSessionRepository>());
        services.AddScoped<IAccountWorkspaces>(
            provider => provider.GetRequiredService<AccountSessionRepository>());
        services.AddScoped<IAccountRecoveryCodeRepository, AccountRecoveryCodeRepository>();
        services.AddScoped<MembershipInvitationRepository>();
        services.AddScoped<IMembershipInvitationRepository>(
            provider => provider.GetRequiredService<MembershipInvitationRepository>());
        services.AddScoped<IInvitationTargets>(
            provider => provider.GetRequiredService<MembershipInvitationRepository>());
    }

    /// <summary>
    /// Outgoing mail. The host that serves the account endpoints also runs
    /// <see cref="EmailDispatcher" />, which drains the in-memory queue.
    /// </summary>
    private static void AddFlowProEmail(this IServiceCollection services, IConfiguration configuration)
    {
        EmailOptions email = configuration.GetSection(EmailOptions.SectionName).Get<EmailOptions>()
            ?? new EmailOptions();

        if (email.IsEnabled && string.IsNullOrWhiteSpace(email.From))
        {
            throw new InvalidOperationException("Email:From must be set when Email:Smtp:Host is.");
        }

        services.Configure<EmailOptions>(configuration.GetSection(EmailOptions.SectionName));
        services.AddSingleton<EmailQueue>();
        services.AddSingleton<IEmailQueue>(provider => provider.GetRequiredService<EmailQueue>());

        if (email.IsEnabled)
        {
            services.AddSingleton<IEmailTransport, SmtpEmailTransport>();
        }
        else
        {
            services.AddSingleton<IEmailTransport, DisabledEmailTransport>();
        }
    }
}
