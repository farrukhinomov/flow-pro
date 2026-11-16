using System.Text.Json;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Sync;
using FlowPro.Domain.Sync;

namespace FlowPro.Application.Requests;

public sealed class RequestWorkflowHandler(
    ICurrentRequestContext requestContext,
    IIdentitySessionRepository sessions,
    ICommandHandler<SubmitSyncBatchCommand, SyncBatchResponse> syncHandler,
    ISyncAggregateRepository aggregateRepository,
    TimeProvider timeProvider) :
    ICommandHandler<SubmitRequestCommand, RequestWorkflowResult>,
    ICommandHandler<DecideRequestCommand, RequestWorkflowResult>,
    ICommandHandler<CancelRequestCommand, RequestWorkflowResult>,
    ICommandHandler<AdjustAndApproveRequestCommand, RequestWorkflowResult>,
    ICommandHandler<CreatePayrollExportCommand, RequestWorkflowResult>
{
    private const long MaxAttachmentSizeBytes = 10 * 1024 * 1024;
    private const int MaxRecurrenceOccurrences = 12;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<RequestWorkflowResult> HandleAsync(
        SubmitRequestCommand command,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        CurrentSession actor = await GetActorAsync(identity, cancellationToken);
        ValidateSubmit(command);

        DateTimeOffset now = timeProvider.GetUtcNow();
        bool autoApproved = command.ApprovalFlow?.AutoApproved == true;
        string requestId = string.IsNullOrWhiteSpace(command.RequestId)
            ? $"request-{Guid.CreateVersion7():N}"
            : command.RequestId.Trim();

        EmployeeRequestDocument request = new(
            requestId,
            command.Kind.Trim(),
            command.EmployeeId,
            command.EmployeeName.Trim(),
            command.FromDate,
            command.ToDate,
            TrimToNull(command.StatusTypeId),
            TrimToNull(command.StatusCode),
            TrimToNull(command.StatusLabel),
            command.Subtype.Trim(),
            TrimToNull(command.ClockIn),
            TrimToNull(command.ClockOut),
            command.ProposedEvents,
            command.PartialDay,
            command.Recurrence,
            null,
            command.Attachments,
            TrimToNull(command.Reason),
            autoApproved ? "approved" : "submitted",
            now,
            now,
            autoApproved
                ? new RequestDecisionSummary(
                    "approve",
                    actor.UserId,
                    "Policy auto-approval",
                    now,
                    "Auto-approved by tenant policy.")
                : null,
            command.ApprovalFlow,
            "synced");

        List<ClientSyncOperation> operations =
        [
            BuildOperation(
                command.ClientOperationId,
                autoApproved ? "request.approve" : "request.submit",
                "request",
                request.Id,
                request,
                now),
            BuildNotificationOperation(
                request.EmployeeId,
                "request.submitted",
                $"Request submitted: {request.Subtype}",
                request.Id,
                now),
        ];

        if (autoApproved && IsAbsenceRequest(request))
        {
            operations.Add(BuildAbsenceOperation(request, now));
        }

        SyncBatchResponse sync = await syncHandler.HandleAsync(
            BuildBatch(command.ClientId, operations),
            cancellationToken);

        return BuildResult(request, operations, sync, now);
    }

    public async Task<RequestWorkflowResult> HandleAsync(
        DecideRequestCommand command,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        CurrentSession actor = await GetActorAsync(identity, cancellationToken);
        ClientAggregate current = await GetRequestAggregateAsync(identity.TenantId, command.RequestId, cancellationToken);
        EmployeeRequestDocument request = DeserializeRequest(current);

        if (!string.Equals(request.Status, "submitted", StringComparison.Ordinal))
        {
            throw new FlowProConflictException(
                "request.not-submitted",
                "Only submitted requests can be decided.");
        }

        DateTimeOffset now = timeProvider.GetUtcNow();
        RequestDecisionSummary summary = new(
            command.Decision == RequestDecision.Approve ? "approve" : "reject",
            actor.UserId,
            actor.DisplayName,
            now,
            TrimToNull(command.Comment));
        RequestApprovalFlow? nextFlow = AdvanceApprovalFlow(request.ApprovalFlow, actor.UserId, summary);
        bool hasPendingStep = nextFlow?.Steps.Any(step => step.Status == "pending") == true;
        string status = command.Decision == RequestDecision.Reject
            ? "rejected"
            : hasPendingStep
                ? "submitted"
                : "approved";

        EmployeeRequestDocument nextRequest = request with
        {
            Status = status,
            UpdatedAt = now,
            Decision = status == "submitted" ? request.Decision : summary,
            ApprovalFlow = nextFlow,
            SyncState = "synced",
        };

        List<ClientSyncOperation> operations =
        [
            BuildOperation(
                command.ClientOperationId,
                command.Decision == RequestDecision.Approve ? "request.approve" : "request.reject",
                "request",
                nextRequest.Id,
                nextRequest,
                now),
            BuildNotificationOperation(
                nextRequest.EmployeeId,
                status == "approved" ? "request.approved" : "request.rejected",
                $"Request {status}: {nextRequest.Subtype}",
                nextRequest.Id,
                now),
        ];

        if (status == "approved" && IsAbsenceRequest(nextRequest))
        {
            operations.Add(BuildAbsenceOperation(nextRequest, now));
        }

        SyncBatchResponse sync = await syncHandler.HandleAsync(
            BuildBatch(command.ClientId, operations),
            cancellationToken);

        return BuildResult(nextRequest, operations, sync, now);
    }

    public async Task<RequestWorkflowResult> HandleAsync(
        CancelRequestCommand command,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        ClientAggregate current = await GetRequestAggregateAsync(identity.TenantId, command.RequestId, cancellationToken);
        EmployeeRequestDocument request = DeserializeRequest(current);

        if (!string.Equals(request.Status, "submitted", StringComparison.Ordinal))
        {
            throw new FlowProConflictException(
                "request.not-submitted",
                "Only submitted requests can be cancelled.");
        }

        DateTimeOffset now = timeProvider.GetUtcNow();
        EmployeeRequestDocument nextRequest = request with
        {
            Status = "cancelled",
            UpdatedAt = now,
            SyncState = "synced",
        };

        List<ClientSyncOperation> operations =
        [
            BuildOperation(
                command.ClientOperationId,
                "request.cancel",
                "request",
                nextRequest.Id,
                nextRequest,
                now),
            BuildNotificationOperation(
                nextRequest.EmployeeId,
                "request.cancelled",
                $"Request cancelled: {nextRequest.Subtype}",
                nextRequest.Id,
                now),
        ];

        SyncBatchResponse sync = await syncHandler.HandleAsync(
            BuildBatch(command.ClientId, operations),
            cancellationToken);

        return BuildResult(nextRequest, operations, sync, now);
    }

    public async Task<RequestWorkflowResult> HandleAsync(
        CreatePayrollExportCommand command,
        CancellationToken cancellationToken)
    {
        ValidatePayrollExport(command);
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        CurrentSession actor = await GetActorAsync(identity, cancellationToken);
        DateTimeOffset now = timeProvider.GetUtcNow();
        string exportId = $"payroll-export-{Guid.CreateVersion7():N}";
        var export = new
        {
            id = exportId,
            period = command.Period.Trim(),
            format = command.Format.Trim(),
            scope = TrimToNull(command.Scope),
            status = "ready",
            requestedByUserId = actor.UserId,
            requestedByName = actor.DisplayName,
            createdAt = now,
            updatedAt = now,
            syncState = "synced",
        };

        List<ClientSyncOperation> operations =
        [
            BuildOperation(command.ClientOperationId, "payroll-export.upsert", "payroll-export", exportId, export, now),
            BuildNotificationOperation(actor.UserId, "payroll.export-ready", $"Payroll export ready: {command.Period.Trim()}", exportId, now),
        ];

        SyncBatchResponse sync = await syncHandler.HandleAsync(
            BuildBatch(command.ClientId, operations),
            cancellationToken);

        ClientAggregateItem primary = new(
            "payroll-export",
            exportId,
            JsonSerializer.SerializeToElement(export, JsonOptions),
            false,
            sync.Accepted.Count > 0 ? sync.Accepted[0].ServerVersion : "accepted",
            now,
            actor.UserId);

        return new RequestWorkflowResult(primary, BuildSideEffects(operations, exportId, now), sync);
    }

    public async Task<RequestWorkflowResult> HandleAsync(
        AdjustAndApproveRequestCommand command,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        CurrentSession actor = await GetActorAsync(identity, cancellationToken);
        ClientAggregate current = await GetRequestAggregateAsync(identity.TenantId, command.RequestId, cancellationToken);
        EmployeeRequestDocument original = DeserializeRequest(current);

        if (!string.Equals(original.Status, "submitted", StringComparison.Ordinal))
        {
            throw new FlowProConflictException(
                "request.not-submitted",
                "Only submitted requests can be adjusted and approved.");
        }

        ValidateSubmit(command.AdjustedRequest);

        DateTimeOffset now = timeProvider.GetUtcNow();
        RequestDecisionSummary cancelledSummary = new(
            "reject",
            actor.UserId,
            actor.DisplayName,
            now,
            $"Replaced by adjusted request from {actor.DisplayName}.");
        EmployeeRequestDocument cancelledOriginal = original with
        {
            Status = "cancelled",
            UpdatedAt = now,
            Decision = cancelledSummary,
            SyncState = "synced",
        };

        RequestDecisionSummary approvedSummary = new(
            "approve",
            actor.UserId,
            actor.DisplayName,
            now,
            TrimToNull(command.Comment) ?? $"Approved with adjusted details replacing request {original.Id}.");
        string adjustedRequestId = string.IsNullOrWhiteSpace(command.AdjustedRequest.RequestId)
            ? $"request-{Guid.CreateVersion7():N}"
            : command.AdjustedRequest.RequestId.Trim();
        EmployeeRequestDocument adjusted = new(
            adjustedRequestId,
            command.AdjustedRequest.Kind.Trim(),
            command.AdjustedRequest.EmployeeId,
            command.AdjustedRequest.EmployeeName.Trim(),
            command.AdjustedRequest.FromDate,
            command.AdjustedRequest.ToDate,
            TrimToNull(command.AdjustedRequest.StatusTypeId),
            TrimToNull(command.AdjustedRequest.StatusCode),
            TrimToNull(command.AdjustedRequest.StatusLabel),
            command.AdjustedRequest.Subtype.Trim(),
            TrimToNull(command.AdjustedRequest.ClockIn),
            TrimToNull(command.AdjustedRequest.ClockOut),
            command.AdjustedRequest.ProposedEvents,
            command.AdjustedRequest.PartialDay,
            command.AdjustedRequest.Recurrence,
            null,
            command.AdjustedRequest.Attachments,
            TrimToNull(command.AdjustedRequest.Reason),
            "approved",
            now,
            now,
            approvedSummary,
            command.AdjustedRequest.ApprovalFlow,
            "synced");

        string operationIdBase = string.IsNullOrWhiteSpace(command.ClientOperationId)
            ? $"api-{Guid.CreateVersion7():N}"
            : command.ClientOperationId.Trim();
        List<ClientSyncOperation> operations =
        [
            BuildOperation(
                $"{operationIdBase}-cancel-original",
                "request.cancel",
                "request",
                cancelledOriginal.Id,
                cancelledOriginal,
                now),
            BuildOperation(
                $"{operationIdBase}-approve-adjusted",
                "request.approve",
                "request",
                adjusted.Id,
                adjusted,
                now),
            BuildNotificationOperation(
                adjusted.EmployeeId,
                "request.adjusted-approved",
                $"Request adjusted and approved: {adjusted.Subtype}",
                adjusted.Id,
                now),
        ];

        if (IsAbsenceRequest(adjusted))
        {
            operations.Add(BuildAbsenceOperation(adjusted, now));
        }

        SyncBatchResponse sync = await syncHandler.HandleAsync(
            BuildBatch(command.ClientId, operations),
            cancellationToken);

        return BuildResult(adjusted, operations, sync, now);
    }

    private static void ValidateSubmit(SubmitRequestCommand command)
    {
        if (command.Kind is not ("absence" or "booking-correction" or "official-absence"))
        {
            throw new FlowProValidationException("request.kind.invalid", "Request kind is invalid.");
        }

        if (command.ToDate < command.FromDate)
        {
            throw new FlowProValidationException("request.date-range.invalid", "Request end date cannot be before start date.");
        }

        if (string.IsNullOrWhiteSpace(command.Subtype))
        {
            throw new FlowProValidationException("request.subtype.required", "Request subtype is required.");
        }

        if (command.Kind == "absence" && string.IsNullOrWhiteSpace(command.StatusTypeId))
        {
            throw new FlowProValidationException("request.status-type.required", "Absence requests require a status type.");
        }

        if (command.Kind == "booking-correction"
            && string.IsNullOrWhiteSpace(command.ClockIn)
            && string.IsNullOrWhiteSpace(command.ClockOut)
            && command.ProposedEvents is null)
        {
            throw new FlowProValidationException("request.booking-correction.empty", "Booking correction requests require a clock time or proposed timeline.");
        }

        if (command.PartialDay?.Mode == "custom"
            && (string.IsNullOrWhiteSpace(command.PartialDay.StartTime)
                || string.IsNullOrWhiteSpace(command.PartialDay.EndTime)
                || string.CompareOrdinal(command.PartialDay.EndTime, command.PartialDay.StartTime) <= 0))
        {
            throw new FlowProValidationException("request.partial-day.invalid", "Custom partial-day requests require a valid time range.");
        }

        if (command.Recurrence is not null
            && (command.Recurrence.Occurrences < 1 || command.Recurrence.Occurrences > MaxRecurrenceOccurrences))
        {
            throw new FlowProValidationException("request.recurrence.invalid", $"Recurring requests cannot exceed {MaxRecurrenceOccurrences} occurrences.");
        }

        RequestAttachment? oversized = command.Attachments.FirstOrDefault(attachment => attachment.Size > MaxAttachmentSizeBytes);
        if (oversized is not null)
        {
            throw new FlowProValidationException("request.attachment.too-large", $"Attachment '{oversized.Name}' exceeds the maximum allowed size.");
        }
    }

    private static void ValidatePayrollExport(CreatePayrollExportCommand command)
    {
        if (string.IsNullOrWhiteSpace(command.Period))
        {
            throw new FlowProValidationException("payroll.period.required", "Payroll export period is required.");
        }

        if (command.Format.Trim() is not ("DATEV" or "Excel" or "Personio"))
        {
            throw new FlowProValidationException("payroll.format.invalid", "Payroll export format must be DATEV, Excel, or Personio.");
        }
    }

    private async Task<CurrentSession> GetActorAsync(RequestIdentity identity, CancellationToken cancellationToken) =>
        await sessions.GetCurrentSessionAsync(identity.TenantId, identity.UserId, cancellationToken)
            ?? throw new FlowProUnauthorizedException();

    private async Task<ClientAggregate> GetRequestAggregateAsync(Guid tenantId, string requestId, CancellationToken cancellationToken) =>
        await aggregateRepository.FindAsync(tenantId, "request", requestId, cancellationToken)
            ?? throw new FlowProNotFoundException("request.not-found", $"Request '{requestId}' was not found.");

    private static EmployeeRequestDocument DeserializeRequest(ClientAggregate aggregate) =>
        JsonSerializer.Deserialize<EmployeeRequestDocument>(aggregate.PayloadJson, JsonOptions)
            ?? throw new FlowProValidationException("request.payload.invalid", "Stored request payload could not be read.");

    private static RequestApprovalFlow? AdvanceApprovalFlow(RequestApprovalFlow? flow, Guid actorUserId, RequestDecisionSummary summary)
    {
        if (flow is null || flow.Steps.Count == 0)
        {
            return flow;
        }

        if (flow.CurrentStepIndex < 0 || flow.CurrentStepIndex >= flow.Steps.Count)
        {
            throw new FlowProValidationException("approval-flow.current-step.invalid", "Approval flow current step is invalid.");
        }

        RequestApprovalStep currentStep = flow.Steps[flow.CurrentStepIndex];
        if (currentStep.ApproverIds.Count > 0 && !currentStep.ApproverIds.Contains(actorUserId))
        {
            throw new FlowProForbiddenException("approval-flow.assigned-to-another-approver", "This request is assigned to another approval step.");
        }

        RequestDecisionSummary[] decisions = [.. currentStep.Decisions, summary];
        bool rejected = summary.Decision == "reject";
        bool approved = !rejected
            && (!currentStep.RequireAll
                || currentStep.ApproverIds.All(approverId => decisions.Any(decision => decision.DecidedById == approverId && decision.Decision == "approve")));

        RequestApprovalStep[] steps = flow.Steps
            .Select((step, index) => index == flow.CurrentStepIndex
                ? step with { Decisions = decisions, Status = rejected ? "rejected" : approved ? "approved" : "pending" }
                : step)
            .ToArray();

        if (rejected || !approved)
        {
            return flow with { Steps = steps };
        }

        int nextIndex = flow.CurrentStepIndex;
        if (nextIndex < steps.Length - 1)
        {
            nextIndex++;
            steps[nextIndex] = steps[nextIndex] with { Status = "pending" };
        }

        return flow with { CurrentStepIndex = nextIndex, Steps = steps };
    }

    private static ClientSyncOperation BuildOperation(string? operationId, string type, string aggregate, string aggregateId, object payload, DateTimeOffset now) =>
        new(
            string.IsNullOrWhiteSpace(operationId) ? $"api-{Guid.CreateVersion7():N}" : operationId.Trim(),
            type,
            aggregate,
            aggregateId,
            JsonSerializer.SerializeToElement(payload, JsonOptions),
            now,
            new ClientSyncConflictResolution("local-wins"));

    private static ClientSyncOperation BuildAbsenceOperation(EmployeeRequestDocument request, DateTimeOffset now) =>
        BuildOperation(
            null,
            "absence.upsert",
            "absence",
            $"absence-{request.Id}",
            new
            {
                id = $"absence-{request.Id}",
                requestId = request.Id,
                employeeId = request.EmployeeId,
                employeeName = request.EmployeeName,
                fromDate = request.FromDate,
                toDate = request.ToDate,
                statusTypeId = request.StatusTypeId,
                statusCode = request.StatusCode,
                statusLabel = request.StatusLabel,
                subtype = request.Subtype,
                partialDay = request.PartialDay,
                reason = request.Reason,
                source = "approved-request",
                approvedAt = now,
                syncState = "synced",
            },
            now);

    private static ClientSyncOperation BuildNotificationOperation(Guid recipientUserId, string type, string title, string sourceId, DateTimeOffset now)
    {
        string notificationId = $"notification-{Guid.CreateVersion7():N}";
        return BuildOperation(
            null,
            "notification.upsert",
            "notification",
            notificationId,
            new
            {
                id = notificationId,
                recipientUserId,
                type,
                title,
                sourceId,
                readAt = (DateTimeOffset?)null,
                createdAt = now,
                syncState = "synced",
            },
            now);
    }

    private static SubmitSyncBatchCommand BuildBatch(string? clientId, IReadOnlyList<ClientSyncOperation> operations) =>
        new("flowpro-sync-v1", string.IsNullOrWhiteSpace(clientId) ? "flowpro-workflow-api" : clientId.Trim(), 1, operations);

    private static RequestWorkflowResult BuildResult(EmployeeRequestDocument request, IReadOnlyList<ClientSyncOperation> operations, SyncBatchResponse sync, DateTimeOffset now)
    {
        ClientAggregateItem primary = new(
            "request",
            request.Id,
            JsonSerializer.SerializeToElement(request, JsonOptions),
            false,
            sync.Accepted.Count > 0 ? sync.Accepted[0].ServerVersion : "accepted",
            now,
            request.EmployeeId);

        return new RequestWorkflowResult(primary, BuildSideEffects(operations, request.Id, now), sync);
    }

    private static ClientAggregateItem[] BuildSideEffects(IReadOnlyList<ClientSyncOperation> operations, string primaryAggregateId, DateTimeOffset now) =>
        operations
            .Where(operation => operation.AggregateId != primaryAggregateId)
            .Select(operation => new ClientAggregateItem(operation.Aggregate, operation.AggregateId, operation.Payload, false, "accepted", now, TryReadOwner(operation.Payload)))
            .ToArray();

    private static Guid? TryReadOwner(JsonElement payload)
    {
        foreach (string property in new[] { "employeeId", "recipientUserId", "requestedByUserId" })
        {
            if (payload.TryGetProperty(property, out JsonElement value)
                && value.ValueKind == JsonValueKind.String
                && Guid.TryParse(value.GetString(), out Guid parsed))
            {
                return parsed;
            }
        }

        return null;
    }

    private static bool IsAbsenceRequest(EmployeeRequestDocument request) => request.Kind is "absence" or "official-absence";

    private static string? TrimToNull(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
