using System.Text.Json;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Integration;
using FlowPro.Application.Sync;
using FlowPro.Domain.Integration;
using FlowPro.Domain.Sync;

namespace FlowPro.Application.Attachments;

public sealed class AttachmentCommandHandler(
    ICurrentRequestContext requestContext,
    IPermissionChecker permissionChecker,
    IAttachmentObjectStore objectStore,
    ISyncAggregateRepository aggregateRepository,
    IOutboxWriter outboxWriter,
    IUnitOfWork unitOfWork,
    AttachmentOptions options,
    TimeProvider timeProvider) :
    ICommandHandler<UploadAttachmentCommand, UploadedAttachment>,
    ICommandHandler<DeleteAttachmentCommand, DeletedAttachment>,
    IQueryHandler<DownloadAttachmentQuery, DownloadedAttachment>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<UploadedAttachment> HandleAsync(
        UploadAttachmentCommand command,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        Validate(command, options);

        if (!await permissionChecker.HasPermissionAsync(
                identity.TenantId,
                identity.UserId,
                PermissionKeys.AttachmentsWriteSelf,
                cancellationToken))
        {
            throw new FlowProForbiddenException(
                "attachments.permission-required",
                $"Permission '{PermissionKeys.AttachmentsWriteSelf}' is required.");
        }

        string attachmentId = Guid.CreateVersion7().ToString();
        StoredAttachmentObject stored = await objectStore.PutAsync(
            new AttachmentObjectWriteRequest(
                identity.TenantId,
                identity.UserId,
                attachmentId,
                command.FileName,
                command.ContentType,
                command.Length,
                command.Content),
            cancellationToken);

        return await unitOfWork.ExecuteAsync(
            transactionCancellationToken =>
                StoreMetadataAsync(
                    identity,
                    command,
                    attachmentId,
                    stored,
                    transactionCancellationToken),
            cancellationToken);
    }

    private async Task<UploadedAttachment> StoreMetadataAsync(
        RequestIdentity identity,
        UploadAttachmentCommand command,
        string attachmentId,
        StoredAttachmentObject stored,
        CancellationToken cancellationToken)
    {
        DateTimeOffset now = timeProvider.GetUtcNow();
        string operationId = string.IsNullOrWhiteSpace(command.ClientOperationId)
            ? $"attachment-upload-{Guid.CreateVersion7():N}"
            : command.ClientOperationId.Trim();
        string clientId = string.IsNullOrWhiteSpace(command.ClientId)
            ? "flowpro-api"
            : command.ClientId.Trim();

        AttachmentPayload payload = new(
            attachmentId,
            stored.ObjectKey,
            Path.GetFileName(command.FileName),
            command.ContentType,
            stored.SizeBytes,
            stored.Sha256,
            stored.StorageProvider,
            identity.UserId,
            now);

        ClientAggregate aggregate = new(
            identity.TenantId,
            "attachment",
            attachmentId,
            JsonSerializer.Serialize(payload, JsonOptions),
            operationId,
            now,
            identity.UserId);
        aggregateRepository.Add(aggregate);

        string eventPayload = JsonSerializer.Serialize(
            new ClientAggregateSyncEvent(
                "attachment",
                attachmentId,
                "attachment.upsert",
                Deleted: false,
                JsonSerializer.SerializeToElement(payload, JsonOptions),
                operationId,
                clientId,
                aggregate.ServerVersion,
                now,
                identity.UserId),
            JsonOptions);

        outboxWriter.Add(
            new OutboxMessage(
                identity.TenantId,
                "client-aggregate.upserted.v1",
                "attachment",
                Guid.Parse(attachmentId),
                eventPayload,
                now));

        return new UploadedAttachment(
            attachmentId,
            stored.ObjectKey,
            payload.FileName,
            payload.ContentType,
            payload.SizeBytes,
            payload.Sha256,
            now,
            identity.UserId,
            aggregate.ServerVersion);
    }

    public async Task<DeletedAttachment> HandleAsync(
        DeleteAttachmentCommand command,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();

        if (!await permissionChecker.HasPermissionAsync(
                identity.TenantId,
                identity.UserId,
                PermissionKeys.AttachmentsWriteSelf,
                cancellationToken))
        {
            throw new FlowProForbiddenException(
                "attachments.permission-required",
                $"Permission '{PermissionKeys.AttachmentsWriteSelf}' is required.");
        }

        return await unitOfWork.ExecuteAsync(
            transactionCancellationToken =>
                DeleteMetadataAsync(identity, command, transactionCancellationToken),
            cancellationToken);
    }

    public async Task<DownloadedAttachment> HandleAsync(
        DownloadAttachmentQuery query,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();

        if (!await permissionChecker.HasPermissionAsync(
                identity.TenantId,
                identity.UserId,
                PermissionKeys.SyncReadSelf,
                cancellationToken))
        {
            throw new FlowProForbiddenException(
                "attachments.read-permission-required",
                $"Permission '{PermissionKeys.SyncReadSelf}' is required.");
        }

        ClientAggregate aggregate = await aggregateRepository.FindAsync(
                identity.TenantId,
                "attachment",
                query.AttachmentId,
                cancellationToken)
            ?? throw new FlowProNotFoundException(
                "attachments.not-found",
                "The requested attachment was not found.");

        if (aggregate.IsDeleted)
        {
            throw new FlowProNotFoundException(
                "attachments.not-found",
                "The requested attachment was not found.");
        }

        if (aggregate.OwnerUserId != identity.UserId)
        {
            throw new FlowProForbiddenException(
                "attachments.owner-required",
                "You can only download your own attachments.");
        }

        AttachmentPayload payload = JsonSerializer.Deserialize<AttachmentPayload>(
                aggregate.PayloadJson,
                JsonOptions)
            ?? throw new FlowProValidationException(
                "attachments.metadata-invalid",
                "Attachment metadata could not be read.");

        Stream content;
        try
        {
            content = await objectStore.OpenReadAsync(
                new AttachmentObjectReadRequest(payload.ObjectKey),
                cancellationToken);
        }
        catch (FileNotFoundException)
        {
            throw new FlowProNotFoundException(
                "attachments.object-not-found",
                "The attachment file was not found in storage.");
        }

        return new DownloadedAttachment(
            payload.Id,
            payload.FileName,
            payload.ContentType,
            payload.SizeBytes,
            payload.Sha256,
            content);
    }

    private async Task<DeletedAttachment> DeleteMetadataAsync(
        RequestIdentity identity,
        DeleteAttachmentCommand command,
        CancellationToken cancellationToken)
    {
        ClientAggregate aggregate = await aggregateRepository.FindAsync(
                identity.TenantId,
                "attachment",
                command.AttachmentId,
                cancellationToken)
            ?? throw new FlowProNotFoundException(
                "attachments.not-found",
                "The requested attachment was not found.");

        if (aggregate.IsDeleted)
        {
            throw new FlowProNotFoundException(
                "attachments.not-found",
                "The requested attachment was not found.");
        }

        if (aggregate.OwnerUserId != identity.UserId)
        {
            throw new FlowProForbiddenException(
                "attachments.owner-required",
                "You can only delete your own attachments.");
        }

        DateTimeOffset now = timeProvider.GetUtcNow();
        DateTimeOffset purgeEligibleAt = now.AddDays(options.SoftDeletedRetentionDays);
        string operationId = string.IsNullOrWhiteSpace(command.ClientOperationId)
            ? $"attachment-delete-{Guid.CreateVersion7():N}"
            : command.ClientOperationId.Trim();
        string clientId = string.IsNullOrWhiteSpace(command.ClientId)
            ? "flowpro-api"
            : command.ClientId.Trim();

        aggregate.Delete(operationId, now);

        string eventPayload = JsonSerializer.Serialize(
            new ClientAggregateSyncEvent(
                "attachment",
                command.AttachmentId,
                "attachment.delete",
                Deleted: true,
                JsonSerializer.SerializeToElement(
                    new AttachmentDeletedPayload(
                        JsonSerializer.Deserialize<JsonElement>(aggregate.PayloadJson),
                        now,
                        purgeEligibleAt,
                        options.SoftDeletedRetentionDays),
                    JsonOptions),
                operationId,
                clientId,
                aggregate.ServerVersion,
                now,
                aggregate.OwnerUserId),
            JsonOptions);

        outboxWriter.Add(
            new OutboxMessage(
                identity.TenantId,
                "client-aggregate.deleted.v1",
                "attachment",
                Guid.Parse(command.AttachmentId),
                eventPayload,
                now));

        return new DeletedAttachment(
            command.AttachmentId,
            now,
            purgeEligibleAt,
            aggregate.ServerVersion);
    }

    private static void Validate(UploadAttachmentCommand command, AttachmentOptions options)
    {
        if (string.IsNullOrWhiteSpace(command.FileName))
        {
            throw new FlowProValidationException(
                "attachments.file-name-required",
                "A file name is required.");
        }

        if (command.Length <= 0)
        {
            throw new FlowProValidationException(
                "attachments.empty-file",
                "The uploaded file must not be empty.");
        }

        if (command.Length > options.MaxUploadBytes)
        {
            throw new FlowProValidationException(
                "attachments.file-too-large",
                $"The uploaded file exceeds the configured limit of {options.MaxUploadBytes} bytes.");
        }

        if (string.IsNullOrWhiteSpace(command.ContentType)
            || !options.AllowedContentTypes.Contains(command.ContentType, StringComparer.OrdinalIgnoreCase))
        {
            throw new FlowProValidationException(
                "attachments.content-type-not-allowed",
                $"Content type '{command.ContentType}' is not allowed.");
        }
    }

    private sealed record AttachmentPayload(
        string Id,
        string ObjectKey,
        string FileName,
        string ContentType,
        long SizeBytes,
        string Sha256,
        string StorageProvider,
        Guid OwnerUserId,
        DateTimeOffset UploadedAt);

    private sealed record AttachmentDeletedPayload(
        JsonElement Attachment,
        DateTimeOffset DeletedAt,
        DateTimeOffset PurgeEligibleAt,
        int RetentionDays);
}
