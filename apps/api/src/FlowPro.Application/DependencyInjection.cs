using FlowPro.Application.Accounts;
using FlowPro.Application.Attachments;
using FlowPro.Application.Attendance;
using FlowPro.Application.Audit;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Notifications;
using FlowPro.Application.Onboarding;
using FlowPro.Application.Operations;
using FlowPro.Application.Organization;
using FlowPro.Application.Payroll;
using FlowPro.Application.Planning;
using FlowPro.Application.Policies;
using FlowPro.Application.Reports;
using FlowPro.Application.Requests;
using FlowPro.Application.Sync;
using FlowPro.Application.Timesheets;
using FlowPro.Application.Users;
using Microsoft.Extensions.DependencyInjection;

namespace FlowPro.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddFlowProApplication(this IServiceCollection services)
    {
        services.AddScoped<AccountMailbox>();
        services.AddScoped<AccountRecoveryHandler>();
        services.AddScoped<ICommandHandler<RequestPasswordResetCommand, EmailRequestAccepted>>(
            provider => provider.GetRequiredService<AccountRecoveryHandler>());
        services.AddScoped<ICommandHandler<ResetPasswordCommand, PasswordResetCompleted>>(
            provider => provider.GetRequiredService<AccountRecoveryHandler>());
        services.AddScoped<ICommandHandler<VerifyEmailCommand, EmailVerificationCompleted>>(
            provider => provider.GetRequiredService<AccountRecoveryHandler>());
        services.AddScoped<ICommandHandler<ResendEmailVerificationCommand, EmailRequestAccepted>>(
            provider => provider.GetRequiredService<AccountRecoveryHandler>());
        services.AddScoped<ICommandHandler<ConfirmEmailChangeCommand, EmailChangeCompleted>>(
            provider => provider.GetRequiredService<AccountRecoveryHandler>());
        services.AddScoped<CurrentPasswordCheck>();
        services.AddScoped<AccountSecurityHandler>();
        services.AddScoped<IQueryHandler<GetAccountOverviewQuery, AccountOverview>>(
            provider => provider.GetRequiredService<AccountSecurityHandler>());
        services.AddScoped<ICommandHandler<ChangePasswordCommand, PasswordChanged>>(
            provider => provider.GetRequiredService<AccountSecurityHandler>());
        services.AddScoped<ICommandHandler<ChangeEmailCommand, EmailRequestAccepted>>(
            provider => provider.GetRequiredService<AccountSecurityHandler>());
        services.AddScoped<ICommandHandler<RevokeSessionCommand, SessionsRevoked>>(
            provider => provider.GetRequiredService<AccountSecurityHandler>());
        services.AddScoped<ICommandHandler<RevokeOtherSessionsCommand, SessionsRevoked>>(
            provider => provider.GetRequiredService<AccountSecurityHandler>());
        services.AddScoped<AccountTwoFactorHandler>();
        services.AddScoped<ICommandHandler<CompleteTwoFactorSignInCommand, IssuedSession>>(
            provider => provider.GetRequiredService<AccountTwoFactorHandler>());
        services.AddScoped<ICommandHandler<StartAuthenticatorSetupCommand, AuthenticatorSetup>>(
            provider => provider.GetRequiredService<AccountTwoFactorHandler>());
        services.AddScoped<ICommandHandler<EnableTwoFactorCommand, TwoFactorEnabled>>(
            provider => provider.GetRequiredService<AccountTwoFactorHandler>());
        services.AddScoped<ICommandHandler<DisableTwoFactorCommand, TwoFactorDisabled>>(
            provider => provider.GetRequiredService<AccountTwoFactorHandler>());
        services.AddScoped<ICommandHandler<RegenerateRecoveryCodesCommand, RecoveryCodesIssued>>(
            provider => provider.GetRequiredService<AccountTwoFactorHandler>());
        services.AddScoped<AccountWorkspaceHandler>();
        services.AddScoped<IQueryHandler<ListWorkspacesQuery, WorkspaceList>>(
            provider => provider.GetRequiredService<AccountWorkspaceHandler>());
        services.AddScoped<ICommandHandler<SwitchWorkspaceCommand, WorkspaceSwitched>>(
            provider => provider.GetRequiredService<AccountWorkspaceHandler>());
        services.AddScoped<AccountSessionIssuer>();
        services.AddScoped<InvitationMailbox>();
        services.AddScoped<InvitationHandler>();
        services.AddScoped<IQueryHandler<PreviewInvitationQuery, InvitationPreview>>(
            provider => provider.GetRequiredService<InvitationHandler>());
        services.AddScoped<ICommandHandler<AcceptInvitationCommand, InvitationAccepted>>(
            provider => provider.GetRequiredService<InvitationHandler>());
        services.AddScoped<ICommandHandler<AcceptInvitationWithNewAccountCommand, IssuedSession>>(
            provider => provider.GetRequiredService<InvitationHandler>());
        services.AddScoped<AccountSessionHandler>();
        services.AddScoped<ICommandHandler<RegisterAccountCommand, IssuedSession>>(
            provider => provider.GetRequiredService<AccountSessionHandler>());
        services.AddScoped<ICommandHandler<SignInCommand, SignInOutcome>>(
            provider => provider.GetRequiredService<AccountSessionHandler>());
        services.AddScoped<ICommandHandler<SignOutCommand, SignedOut>>(
            provider => provider.GetRequiredService<AccountSessionHandler>());
        services.AddScoped<IQueryHandler<ResolveSessionQuery, ResolvedSession?>>(
            provider => provider.GetRequiredService<AccountSessionHandler>());

        services.AddScoped<AttachmentCommandHandler>();
        services.AddScoped<ICommandHandler<UploadAttachmentCommand, UploadedAttachment>>(
            provider => provider.GetRequiredService<AttachmentCommandHandler>());
        services.AddScoped<ICommandHandler<DeleteAttachmentCommand, DeletedAttachment>>(
            provider => provider.GetRequiredService<AttachmentCommandHandler>());
        services.AddScoped<IQueryHandler<DownloadAttachmentQuery, DownloadedAttachment>>(
            provider => provider.GetRequiredService<AttachmentCommandHandler>());

        services.AddScoped<AttendanceCommandHandler>();
        services.AddScoped<ICommandHandler<ExecuteAttendanceCommand, AttendanceCommandResult>>(
            provider => provider.GetRequiredService<AttendanceCommandHandler>());
        services.AddScoped<ICommandHandler<CreateManualTimeBookingCommand, AttendanceCommandResult>>(
            provider => provider.GetRequiredService<AttendanceCommandHandler>());
        services.AddScoped<ICommandHandler<CorrectTimeBookingCommand, AttendanceCommandResult>>(
            provider => provider.GetRequiredService<AttendanceCommandHandler>());
        services.AddScoped<ICommandHandler<VoidTimeBookingCommand, VoidTimeBookingResult>>(
            provider => provider.GetRequiredService<AttendanceCommandHandler>());

        services.AddScoped<AttendanceQueryHandler>();
        services.AddScoped<IQueryHandler<GetCurrentAttendanceStatusQuery, AttendanceStatus>>(
            provider => provider.GetRequiredService<AttendanceQueryHandler>());
        services.AddScoped<IQueryHandler<ListAttendanceEventsQuery, AttendanceEventPage>>(
            provider => provider.GetRequiredService<AttendanceQueryHandler>());

        services.AddScoped<AuditWorkflowHandler>();
        services.AddScoped<IQueryHandler<ListAuditEventsQuery, AuditEventPage>>(
            provider => provider.GetRequiredService<AuditWorkflowHandler>());

        services.AddScoped<IQueryHandler<GetCurrentSessionQuery, CurrentSession>, IdentityQueryHandler>();

        services.AddScoped<UserPreferencesHandler>();
        services.AddScoped<IQueryHandler<GetUserPreferencesQuery, UserPreferencesDto>>(
            provider => provider.GetRequiredService<UserPreferencesHandler>());
        services.AddScoped<ICommandHandler<SaveUserPreferencesCommand, UserPreferencesDto>>(
            provider => provider.GetRequiredService<UserPreferencesHandler>());

        services.AddScoped<NotificationWorkflowHandler>();
        services.AddScoped<IQueryHandler<ListNotificationsQuery, NotificationPage>>(
            provider => provider.GetRequiredService<NotificationWorkflowHandler>());
        services.AddScoped<IQueryHandler<GetNotificationPreferencesQuery, NotificationPreferencesDto>>(
            provider => provider.GetRequiredService<NotificationWorkflowHandler>());
        services.AddScoped<ICommandHandler<MarkNotificationReadCommand, NotificationDto>>(
            provider => provider.GetRequiredService<NotificationWorkflowHandler>());
        services.AddScoped<ICommandHandler<MarkAllNotificationsReadCommand, MarkAllNotificationsReadResult>>(
            provider => provider.GetRequiredService<NotificationWorkflowHandler>());
        services.AddScoped<ICommandHandler<SaveNotificationPreferencesCommand, NotificationPreferencesDto>>(
            provider => provider.GetRequiredService<NotificationWorkflowHandler>());

        services.AddScoped<WorkspaceProvisioner>();
        services.AddScoped<WorkspaceClaimHandler>();
        services.AddScoped<IQueryHandler<GetWorkspaceClaimStateQuery, WorkspaceClaimState>>(
            provider => provider.GetRequiredService<WorkspaceClaimHandler>());
        services.AddScoped<ICommandHandler<ClaimWorkspaceCommand, WorkspaceClaimResult>>(
            provider => provider.GetRequiredService<WorkspaceClaimHandler>());

        services.AddScoped<OnboardingWorkflowHandler>();
        services.AddScoped<IQueryHandler<GetOnboardingStateQuery, OnboardingStateDto>>(
            provider => provider.GetRequiredService<OnboardingWorkflowHandler>());
        services.AddScoped<ICommandHandler<SaveCompanyProfileCommand, CompanyProfileDto>>(
            provider => provider.GetRequiredService<OnboardingWorkflowHandler>());
        services.AddScoped<ICommandHandler<ResolveOnboardingStepCommand, OnboardingStateDto>>(
            provider => provider.GetRequiredService<OnboardingWorkflowHandler>());
        services.AddScoped<ICommandHandler<CompleteOnboardingCommand, OnboardingStateDto>>(
            provider => provider.GetRequiredService<OnboardingWorkflowHandler>());

        services.AddScoped<OperationsHealthHandler>();
        services.AddScoped<IQueryHandler<GetOperationsHealthQuery, OperationsHealthDto>>(
            provider => provider.GetRequiredService<OperationsHealthHandler>());

        services.AddScoped<RequestWorkflowHandler>();
        services.AddScoped<ICommandHandler<SubmitRequestCommand, RequestWorkflowResult>>(
            provider => provider.GetRequiredService<RequestWorkflowHandler>());
        services.AddScoped<ICommandHandler<DecideRequestCommand, RequestWorkflowResult>>(
            provider => provider.GetRequiredService<RequestWorkflowHandler>());
        services.AddScoped<ICommandHandler<CancelRequestCommand, RequestWorkflowResult>>(
            provider => provider.GetRequiredService<RequestWorkflowHandler>());
        services.AddScoped<ICommandHandler<AdjustAndApproveRequestCommand, RequestWorkflowResult>>(
            provider => provider.GetRequiredService<RequestWorkflowHandler>());
        services.AddScoped<ICommandHandler<CreatePayrollExportCommand, RequestWorkflowResult>>(
            provider => provider.GetRequiredService<RequestWorkflowHandler>());

        services.AddScoped<ReportWorkflowHandler>();
        services.AddScoped<IQueryHandler<GetReportsPackageQuery, ReportsPackageDto>>(
            provider => provider.GetRequiredService<ReportWorkflowHandler>());

        services.AddScoped<SyncCommandHandler>();
        services.AddScoped<ICommandHandler<SubmitSyncBatchCommand, SyncBatchResponse>>(
            provider => provider.GetRequiredService<SyncCommandHandler>());
        services.AddScoped<SyncQueryHandler>();
        services.AddScoped<IQueryHandler<ListSyncChangesQuery, SyncPage>>(
            provider => provider.GetRequiredService<SyncQueryHandler>());
        services.AddScoped<IQueryHandler<ListClientAggregatesQuery, ClientAggregatePage>>(
            provider => provider.GetRequiredService<SyncQueryHandler>());

        services.AddScoped<UserWorkflowHandler>();
        services.AddScoped<IQueryHandler<ListUsersQuery, UserDirectoryPage>>(
            provider => provider.GetRequiredService<UserWorkflowHandler>());
        services.AddScoped<ICommandHandler<UpsertUserCommand, UserWorkflowResult>>(
            provider => provider.GetRequiredService<UserWorkflowHandler>());
        services.AddScoped<ICommandHandler<InviteUserCommand, UserWorkflowResult>>(
            provider => provider.GetRequiredService<UserWorkflowHandler>());
        services.AddScoped<ICommandHandler<ResendInvitationCommand, UserWorkflowResult>>(
            provider => provider.GetRequiredService<UserWorkflowHandler>());
        services.AddScoped<ICommandHandler<DeactivateUserCommand, UserWorkflowResult>>(
            provider => provider.GetRequiredService<UserWorkflowHandler>());
        services.AddScoped<ICommandHandler<ReactivateUserCommand, UserWorkflowResult>>(
            provider => provider.GetRequiredService<UserWorkflowHandler>());

        services.AddScoped<OrganizationCatalogHandler>();
        services.AddScoped<IQueryHandler<ListOrganizationCatalogQuery, OrganizationCatalogPage>>(
            provider => provider.GetRequiredService<OrganizationCatalogHandler>());
        services.AddScoped<ICommandHandler<SaveOrganizationCatalogRecordCommand, OrganizationCatalogRecordDto>>(
            provider => provider.GetRequiredService<OrganizationCatalogHandler>());
        services.AddScoped<ICommandHandler<SetManagerDelegationsCommand, ManagerDelegationPage>>(
            provider => provider.GetRequiredService<OrganizationCatalogHandler>());

        services.AddScoped<EmploymentContractWorkflowHandler>();
        services.AddScoped<IQueryHandler<ListEmploymentContractsQuery, EmploymentContractPage>>(
            provider => provider.GetRequiredService<EmploymentContractWorkflowHandler>());
        services.AddScoped<ICommandHandler<SaveEmploymentContractCommand, EmploymentContractDto>>(
            provider => provider.GetRequiredService<EmploymentContractWorkflowHandler>());

        services.AddScoped<PlanningWorkflowHandler>();
        services.AddScoped<IQueryHandler<GetPlanningPackageQuery, PlanningPackageDto>>(
            provider => provider.GetRequiredService<PlanningWorkflowHandler>());

        services.AddScoped<PayrollExportArtifactHandler>();
        services.AddScoped<ICommandHandler<CreatePayrollExportArtifactCommand, PayrollExportArtifactDto>>(
            provider => provider.GetRequiredService<PayrollExportArtifactHandler>());
        services.AddScoped<IQueryHandler<ListPayrollExportArtifactsQuery, PayrollExportArtifactPage>>(
            provider => provider.GetRequiredService<PayrollExportArtifactHandler>());
        services.AddScoped<IQueryHandler<DownloadPayrollExportArtifactQuery, DownloadedPayrollExportArtifact>>(
            provider => provider.GetRequiredService<PayrollExportArtifactHandler>());

        services.AddScoped<AttendancePolicyWorkflowHandler>();
        services.AddScoped<IQueryHandler<GetAttendancePolicyConfigQuery, System.Text.Json.JsonElement?>>(
            provider => provider.GetRequiredService<AttendancePolicyWorkflowHandler>());
        services.AddScoped<IQueryHandler<GetAttendancePolicyHistoryQuery, IReadOnlyList<AttendancePolicyVersionDto>>>(
            provider => provider.GetRequiredService<AttendancePolicyWorkflowHandler>());
        services.AddScoped<ICommandHandler<PublishAttendancePolicyConfigCommand, System.Text.Json.JsonElement>>(
            provider => provider.GetRequiredService<AttendancePolicyWorkflowHandler>());

        services.AddScoped<TimesheetWorkflowHandler>();
        services.AddScoped<IQueryHandler<GetMonthlyTimesheetQuery, MonthlyTimesheetApprovalDto>>(
            provider => provider.GetRequiredService<TimesheetWorkflowHandler>());
        services.AddScoped<ICommandHandler<SignMonthlyTimesheetCommand, MonthlyTimesheetApprovalDto>>(
            provider => provider.GetRequiredService<TimesheetWorkflowHandler>());
        services.AddScoped<ICommandHandler<ReopenMonthlyTimesheetCommand, MonthlyTimesheetApprovalDto>>(
            provider => provider.GetRequiredService<TimesheetWorkflowHandler>());
        services.AddScoped<ICommandHandler<MarkTimesheetExportedCommand, MonthlyTimesheetApprovalDto>>(
            provider => provider.GetRequiredService<TimesheetWorkflowHandler>());
        return services;
    }
}
