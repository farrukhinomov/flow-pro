using FlowPro.Domain.Common;

namespace FlowPro.Domain.Notifications;

public sealed class NotificationPreferencesRecord : ITrackedEntity
{
    private NotificationPreferencesRecord()
    {
    }

    public NotificationPreferencesRecord(
        Guid tenantId,
        Guid ownerUserId,
        bool approvalQueue,
        bool requestDecisions,
        bool securityEmails,
        bool syncFailures,
        bool timesheetExceptions,
        bool weeklySummary)
    {
        Id = Guid.CreateVersion7();
        TenantId = tenantId;
        OwnerUserId = ownerUserId;
        Update(
            approvalQueue,
            requestDecisions,
            securityEmails,
            syncFailures,
            timesheetExceptions,
            weeklySummary);
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid OwnerUserId { get; private set; }

    public bool ApprovalQueue { get; private set; }

    public bool RequestDecisions { get; private set; }

    public bool SecurityEmails { get; private set; }

    public bool SyncFailures { get; private set; }

    public bool TimesheetExceptions { get; private set; }

    public bool WeeklySummary { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public long Version { get; private set; }

    public void Update(
        bool approvalQueue,
        bool requestDecisions,
        bool securityEmails,
        bool syncFailures,
        bool timesheetExceptions,
        bool weeklySummary)
    {
        ApprovalQueue = approvalQueue;
        RequestDecisions = requestDecisions;
        SecurityEmails = securityEmails;
        SyncFailures = syncFailures;
        TimesheetExceptions = timesheetExceptions;
        WeeklySummary = weeklySummary;
        Version++;
    }
}
