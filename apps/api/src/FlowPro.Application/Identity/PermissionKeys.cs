namespace FlowPro.Application.Identity;

public static class PermissionKeys
{
    public const string AbsencesWriteSelf = "absences.write.self";
    public const string ApprovalWorkflowsManage = "approval-workflows.manage";
    public const string AttachmentsWriteSelf = "attachments.write.self";
    public const string AuditViewFull = "audit.view.full";
    public const string AttendanceClockSelf = "attendance.clock.self";
    public const string AttendanceCorrectSelf = "attendance.correct.self";
    public const string AttendancePolicyManage = "attendance-policy.manage";
    public const string AttendanceViewSelf = "attendance.view.self";
    public const string NotificationsManage = "notifications.manage";
    public const string NotificationsWriteSelf = "notifications.write.self";
    public const string OrganizationManage = "organization.manage";
    public const string PayrollExportsManage = "payroll-exports.manage";
    public const string RequestsApprove = "requests.approve";
    public const string RequestsWriteSelf = "requests.write.self";
    public const string SyncReadSelf = "sync.read.self";
    public const string SyncWriteSelf = "sync.write.self";
    public const string TimesheetsManage = "timesheets.manage";
    public const string TimesheetsWriteSelf = "timesheets.write.self";
    public const string UsersManage = "users.manage";

    public static readonly IReadOnlyList<string> All =
    [
        AbsencesWriteSelf,
        ApprovalWorkflowsManage,
        AttachmentsWriteSelf,
        AuditViewFull,
        AttendanceClockSelf,
        AttendanceCorrectSelf,
        AttendancePolicyManage,
        AttendanceViewSelf,
        NotificationsManage,
        NotificationsWriteSelf,
        OrganizationManage,
        PayrollExportsManage,
        RequestsApprove,
        RequestsWriteSelf,
        SyncReadSelf,
        SyncWriteSelf,
        TimesheetsManage,
        TimesheetsWriteSelf,
        UsersManage,
    ];
}
