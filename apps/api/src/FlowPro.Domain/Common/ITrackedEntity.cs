namespace FlowPro.Domain.Common;

public interface ITrackedEntity
{
    DateTimeOffset CreatedAt { get; }

    DateTimeOffset UpdatedAt { get; }

    long Version { get; }
}
