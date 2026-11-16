using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Domain.Audit;

namespace FlowPro.Application.Audit;

public sealed class AuditWorkflowHandler(
    ICurrentRequestContext requestContext,
    IPermissionChecker permissionChecker,
    IAuditEventRepository repository)
    : IQueryHandler<ListAuditEventsQuery, AuditEventPage>
{
    public async Task<AuditEventPage> HandleAsync(
        ListAuditEventsQuery query,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        await RequireAuditAccessAsync(identity, cancellationToken);

        CursorPageRequest page = query.Page ?? new CursorPageRequest();
        int offset = OffsetCursor.Decode(page.Cursor);
        int limit = page.NormalizedLimit;
        IReadOnlyList<AuditEvent> events = await repository.ListAsync(
            identity.TenantId,
            query.Filter,
            offset,
            limit + 1,
            cancellationToken);
        AuditEvent[] pageItems = events.Take(limit).ToArray();
        string? nextCursor = events.Count > limit
            ? OffsetCursor.Encode(offset + pageItems.Length)
            : null;

        return new AuditEventPage(pageItems.Select(Map).ToArray(), nextCursor);
    }

    private async Task RequireAuditAccessAsync(
        RequestIdentity identity,
        CancellationToken cancellationToken)
    {
        if (await permissionChecker.HasPermissionAsync(
            identity.TenantId,
            identity.UserId,
            PermissionKeys.AuditViewFull,
            cancellationToken))
        {
            return;
        }

        throw new FlowProForbiddenException(
            "audit.permission_required",
            $"Permission '{PermissionKeys.AuditViewFull}' is required.");
    }

    private static AuditEventDto Map(AuditEvent auditEvent) =>
        new(
            auditEvent.Id,
            auditEvent.Sequence,
            auditEvent.ActorUserId,
            auditEvent.Action,
            auditEvent.AggregateType,
            auditEvent.AggregateId,
            auditEvent.DetailsJson,
            auditEvent.OccurredAt);
}
