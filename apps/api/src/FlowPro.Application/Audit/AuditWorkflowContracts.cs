using FlowPro.Application.Common;

namespace FlowPro.Application.Audit;

public sealed record ListAuditEventsQuery(
    CursorPageRequest? Page = null,
    AuditEventFilter? Filter = null) : IQuery<AuditEventPage>;

public sealed record AuditEventFilter(
    string? AggregateType = null,
    Guid? ActorUserId = null,
    string? Action = null,
    string? Search = null);

public sealed record AuditEventPage(
    IReadOnlyList<AuditEventDto> Items,
    string? NextCursor = null);

public sealed record AuditEventDto(
    Guid Id,
    long Sequence,
    Guid ActorUserId,
    string Action,
    string AggregateType,
    Guid AggregateId,
    string DetailsJson,
    DateTimeOffset OccurredAt);
