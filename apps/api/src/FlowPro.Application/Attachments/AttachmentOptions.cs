namespace FlowPro.Application.Attachments;

public sealed class AttachmentOptions
{
    public const string SectionName = "Attachments";

    public long MaxUploadBytes { get; init; } = 10 * 1024 * 1024;

    public int SoftDeletedRetentionDays { get; init; } = 180;

    public string[] AllowedContentTypes { get; init; } =
    [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "text/csv",
        "text/plain",
    ];
}
