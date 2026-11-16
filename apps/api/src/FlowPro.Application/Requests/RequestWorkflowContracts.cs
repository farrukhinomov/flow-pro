using System.Text.Json;
using FlowPro.Application.Common;
using FlowPro.Application.Sync;

namespace FlowPro.Application.Requests;

public sealed record SubmitRequestCommand(
    string? RequestId,
    string Kind,
    Guid EmployeeId,
    string EmployeeName,
    DateOnly FromDate,
    DateOnly ToDate,
    string Subtype,
    string? StatusTypeId,
    string? StatusCode,
    string? StatusLabel,
    string? ClockIn,
    string? ClockOut,
    JsonElement? ProposedEvents,
    RequestPartialDay? PartialDay,
    RequestRecurrence? Recurrence,
    IReadOnlyList<RequestAttachment> Attachments,
    string? Reason,
    RequestApprovalFlow? ApprovalFlow,
    string? ClientId,
    string? ClientOperationId) : ICommand<RequestWorkflowResult>;

public sealed record DecideRequestCommand(
    string RequestId,
    RequestDecision Decision,
    string? Comment,
    string? ClientId,
    string? ClientOperationId) : ICommand<RequestWorkflowResult>;

public sealed record CancelRequestCommand(
    string RequestId,
    string? ClientId,
    string? ClientOperationId) : ICommand<RequestWorkflowResult>;

public sealed record AdjustAndApproveRequestCommand(
    string RequestId,
    SubmitRequestCommand AdjustedRequest,
    string? Comment,
    string? ClientId,
    string? ClientOperationId) : ICommand<RequestWorkflowResult>;

public sealed record CreatePayrollExportCommand(
    string Period,
    string Format,
    string? Scope,
    string? ClientId,
    string? ClientOperationId) : ICommand<RequestWorkflowResult>;

public enum RequestDecision
{
    Approve,
    Reject,
}

public sealed record RequestPartialDay(string Mode, string? StartTime, string? EndTime);

public sealed record RequestRecurrence(string Frequency, int Occurrences);

public sealed record RequestAttachment(
    string Id,
    string Name,
    long Size,
    string Type,
    DateTimeOffset AddedAt,
    string? ObjectKey,
    string? Sha256,
    string? ServerVersion,
    string? StorageProvider,
    DateTimeOffset? UploadedAt,
    Guid? OwnerUserId);

public sealed record RequestDecisionSummary(
    string Decision,
    Guid DecidedById,
    string DecidedByName,
    DateTimeOffset DecidedAt,
    string? Comment);

public sealed record RequestApprovalStep(
    string Id,
    string Label,
    IReadOnlyList<Guid> ApproverIds,
    IReadOnlyList<string> ApproverNames,
    bool RequireAll,
    string Status,
    IReadOnlyList<RequestDecisionSummary> Decisions);

public sealed record RequestApprovalFlow(
    int CurrentStepIndex,
    IReadOnlyList<RequestApprovalStep> Steps,
    bool AutoApproved);

public sealed record EmployeeRequestDocument(
    string Id,
    string Kind,
    Guid EmployeeId,
    string EmployeeName,
    DateOnly FromDate,
    DateOnly ToDate,
    string? StatusTypeId,
    string? StatusCode,
    string? StatusLabel,
    string Subtype,
    string? ClockIn,
    string? ClockOut,
    JsonElement? ProposedEvents,
    RequestPartialDay? PartialDay,
    RequestRecurrence? Recurrence,
    string? SeriesId,
    IReadOnlyList<RequestAttachment> Attachments,
    string? Reason,
    string Status,
    DateTimeOffset SubmittedAt,
    DateTimeOffset UpdatedAt,
    RequestDecisionSummary? Decision,
    RequestApprovalFlow? ApprovalFlow,
    string SyncState);

public sealed record RequestWorkflowResult(
    ClientAggregateItem Primary,
    IReadOnlyList<ClientAggregateItem> SideEffects,
    SyncBatchResponse Sync);
