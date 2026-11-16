using System.Text.Json;

namespace FlowPro.Application.Sync;

public static class ClientProjectionEventTypes
{
    public const string Upserted = "client-projection.upserted.v1";
    public const string Deleted = "client-projection.deleted.v1";
}

public sealed record ClientProjectionEvent(
    string Projection,
    string ProjectionId,
    bool Deleted,
    JsonElement Payload,
    DateTimeOffset OccurredAt,
    Guid? OwnerUserId = null);
