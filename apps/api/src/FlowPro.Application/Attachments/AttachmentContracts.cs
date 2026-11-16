using FlowPro.Application.Common;

namespace FlowPro.Application.Attachments;

public sealed record UploadAttachmentCommand(
    string FileName,
    string ContentType,
    long Length,
    Stream Content,
    string? ClientId,
    string? ClientOperationId) : ICommand<UploadedAttachment>;

public sealed record DeleteAttachmentCommand(
    string AttachmentId,
    string? ClientId,
    string? ClientOperationId) : ICommand<DeletedAttachment>;

public sealed record DownloadAttachmentQuery(string AttachmentId) : IQuery<DownloadedAttachment>;

public sealed record UploadedAttachment(
    string Id,
    string ObjectKey,
    string FileName,
    string ContentType,
    long SizeBytes,
    string Sha256,
    DateTimeOffset UploadedAt,
    Guid OwnerUserId,
    string ServerVersion);

public sealed record DownloadedAttachment(
    string Id,
    string FileName,
    string ContentType,
    long SizeBytes,
    string Sha256,
    Stream Content);

public sealed record DeletedAttachment(
    string Id,
    DateTimeOffset DeletedAt,
    DateTimeOffset PurgeEligibleAt,
    string ServerVersion);

public sealed record StoredAttachmentObject(
    string ObjectKey,
    long SizeBytes,
    string Sha256,
    string StorageProvider);

public interface IAttachmentObjectStore
{
    Task<StoredAttachmentObject> PutAsync(
        AttachmentObjectWriteRequest request,
        CancellationToken cancellationToken);

    Task<Stream> OpenReadAsync(
        AttachmentObjectReadRequest request,
        CancellationToken cancellationToken);
}

public sealed record AttachmentObjectWriteRequest(
    Guid TenantId,
    Guid OwnerUserId,
    string AttachmentId,
    string FileName,
    string ContentType,
    long Length,
    Stream Content);

public sealed record AttachmentObjectReadRequest(string ObjectKey);
