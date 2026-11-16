using System.Text.Json;

using FlowPro.Application.Common;

namespace FlowPro.Application.Sync;

public sealed record ListSyncChangesQuery(long AfterSequence, int Limit) : IQuery<SyncPage>;

public sealed record ListClientAggregatesQuery(
    string Aggregate,
    CursorPageRequest? Page,
    bool IncludeDeleted,
    bool OwnerOnly) : IQuery<ClientAggregatePage>;

public sealed record SubmitSyncBatchCommand(
    string Protocol,
    string ClientId,
    int SchemaVersion,
    IReadOnlyList<ClientSyncOperation> Operations) : ICommand<SyncBatchResponse>;

public sealed record ClientSyncOperation(
    string Id,
    string Type,
    string Aggregate,
    string AggregateId,
    JsonElement Payload,
    DateTimeOffset ClientCreatedAt,
    ClientSyncConflictResolution? Conflict);

public sealed record ClientSyncConflictResolution(string? Resolution);

public sealed record SyncChange(
    long Sequence,
    string EventType,
    string AggregateType,
    Guid AggregateId,
    JsonElement Payload,
    DateTimeOffset OccurredAt);

public sealed record SyncPage(IReadOnlyList<SyncChange> Items, long NextCursor);

public sealed record SyncBatchResponse(
    IReadOnlyList<SyncAcceptedOperation> Accepted,
    IReadOnlyList<SyncConflict> Conflicts,
    IReadOnlyList<SyncRejectedOperation> Rejected,
    DateTimeOffset ServerTime);

public sealed record SyncAcceptedOperation(
    string OperationId,
    string ServerVersion,
    DateTimeOffset SyncedAt);

public sealed record SyncConflict(
    string OperationId,
    string Aggregate,
    string AggregateId,
    string Message,
    string ServerVersion,
    JsonElement RemotePayload);

public sealed record SyncRejectedOperation(
    string OperationId,
    string Message,
    bool Retryable);

public sealed record ClientAggregateSyncEvent(
    string Aggregate,
    string AggregateId,
    string OperationType,
    bool Deleted,
    JsonElement Payload,
    string ClientOperationId,
    string ClientId,
    string ServerVersion,
    DateTimeOffset SyncedAt,
    Guid? OwnerUserId);

public sealed record ClientAggregateItem(
    string Aggregate,
    string AggregateId,
    JsonElement Payload,
    bool IsDeleted,
    string ServerVersion,
    DateTimeOffset UpdatedAt,
    Guid? OwnerUserId);

public sealed record ClientAggregatePage(
    IReadOnlyList<ClientAggregateItem> Items,
    string? NextCursor = null);
