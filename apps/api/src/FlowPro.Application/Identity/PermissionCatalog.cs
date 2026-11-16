namespace FlowPro.Application.Identity;

/// <summary>
/// Canonical descriptions for every permission in <see cref="PermissionKeys" />, and the default
/// role bundles a freshly provisioned workspace starts with.
/// </summary>
public static class PermissionCatalog
{
    public const string SuperadminRoleKey = "superadmin";
    public const string ManagerRoleKey = "manager";
    public const string EmployeeRoleKey = "employee";

    /// <summary>
    /// Permissions every employee holds over their own records.
    /// </summary>
    public static readonly IReadOnlyList<string> EmployeePermissions =
    [
        PermissionKeys.AbsencesWriteSelf,
        PermissionKeys.AttachmentsWriteSelf,
        PermissionKeys.AttendanceClockSelf,
        PermissionKeys.AttendanceCorrectSelf,
        PermissionKeys.AttendanceViewSelf,
        PermissionKeys.NotificationsWriteSelf,
        PermissionKeys.RequestsWriteSelf,
        PermissionKeys.SyncReadSelf,
        PermissionKeys.SyncWriteSelf,
        PermissionKeys.TimesheetsWriteSelf,
    ];

    /// <summary>
    /// Employee permissions plus the approval and timesheet duties a line manager performs.
    /// </summary>
    public static readonly IReadOnlyList<string> ManagerPermissions =
    [
        .. EmployeePermissions,
        PermissionKeys.RequestsApprove,
        PermissionKeys.TimesheetsManage,
    ];

    /// <summary>
    /// The workspace owner holds everything, including audit and policy administration.
    /// </summary>
    public static readonly IReadOnlyList<string> SuperadminPermissions = PermissionKeys.All;

    private static readonly Dictionary<string, string> Descriptions =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            [PermissionKeys.AbsencesWriteSelf] = "Create and update own absence records.",
            [PermissionKeys.ApprovalWorkflowsManage] = "Manage tenant approval workflow rules.",
            [PermissionKeys.AttachmentsWriteSelf] = "Upload and update own attachments.",
            [PermissionKeys.AuditViewFull] = "View full tenant audit evidence.",
            [PermissionKeys.AttendanceClockSelf] = "Clock own attendance.",
            [PermissionKeys.AttendanceCorrectSelf] = "Correct own attendance bookings.",
            [PermissionKeys.AttendancePolicyManage] = "Manage attendance policies and attendance types.",
            [PermissionKeys.AttendanceViewSelf] = "View own attendance.",
            [PermissionKeys.NotificationsManage] = "Manage tenant notification records.",
            [PermissionKeys.NotificationsWriteSelf] = "Manage own notification preferences.",
            [PermissionKeys.OrganizationManage] = "Manage organization catalogs.",
            [PermissionKeys.PayrollExportsManage] = "Create and manage payroll exports.",
            [PermissionKeys.RequestsApprove] = "Approve and reject employee requests.",
            [PermissionKeys.RequestsWriteSelf] = "Create and update own requests.",
            [PermissionKeys.SyncReadSelf] = "Read own synchronization feed.",
            [PermissionKeys.SyncWriteSelf] = "Write own synchronization changes.",
            [PermissionKeys.TimesheetsManage] = "Manage employee timesheets.",
            [PermissionKeys.TimesheetsWriteSelf] = "Update own timesheet records.",
            [PermissionKeys.UsersManage] = "Manage users and access.",
        };

    public static string Describe(string permissionKey) =>
        Descriptions.TryGetValue(permissionKey, out string? description)
            ? description
            : permissionKey;

    public static IReadOnlyList<string> PermissionsForRole(string roleKey) => roleKey switch
    {
        SuperadminRoleKey => SuperadminPermissions,
        ManagerRoleKey => ManagerPermissions,
        EmployeeRoleKey => EmployeePermissions,
        _ => [],
    };
}
