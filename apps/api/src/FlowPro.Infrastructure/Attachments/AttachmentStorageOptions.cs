namespace FlowPro.Infrastructure.Attachments;

public sealed class AttachmentStorageOptions
{
    public const string SectionName = "AttachmentStorage";

    public string Provider { get; init; } = "Local";

    public string LocalRootPath { get; init; } = "/var/lib/flowpro/attachments";

    public string? Endpoint { get; init; }

    public string? Bucket { get; init; }

    public string? Region { get; init; }
}
