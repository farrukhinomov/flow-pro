using System.Text;
using System.Text.Json;
using FlowPro.Application.Attachments;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Integration;
using FlowPro.Application.Sync;
using FlowPro.Domain.Integration;
using FlowPro.Domain.Sync;

namespace FlowPro.Application.Tests.Attachments;

public sealed class AttachmentCommandHandlerTests
{
    private static readonly Guid TenantId = Guid.Parse("01975fa8-7590-7000-8000-000000003001");
    private static readonly Guid UserId = Guid.Parse("01975fa8-7590-7000-8000-000000003002");
    private static readonly DateTimeOffset Now = new(2026, 6, 5, 8, 0, 0, TimeSpan.Zero);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [Fact]
    public async Task Upload_stores_file_metadata_and_emits_sync_event()
    {
        TestFixture fixture = new();

        UploadedAttachment uploaded = await fixture.Handler.HandleAsync(
            CreateCommand("contract.pdf", "application/pdf", "signed"),
            CancellationToken.None);

        Assert.Equal("contract.pdf", uploaded.FileName);
        Assert.Equal("application/pdf", uploaded.ContentType);
        Assert.Equal(UserId, uploaded.OwnerUserId);
        Assert.Equal(6, uploaded.SizeBytes);
        Assert.Equal("local", fixture.ObjectStore.LastRequest?.StorageProvider);
        Assert.Single(fixture.Repository.Aggregates);

        ClientAggregate aggregate = Assert.Single(fixture.Repository.Aggregates);
        Assert.Equal("attachment", aggregate.AggregateType);
        Assert.Equal(uploaded.Id, aggregate.AggregateId);
        Assert.Equal(UserId, aggregate.OwnerUserId);

        OutboxMessage message = Assert.Single(fixture.Outbox.Messages);
        Assert.Equal("client-aggregate.upserted.v1", message.EventType);
        Assert.Contains(uploaded.Id, message.PayloadJson, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Upload_rejects_disallowed_content_type()
    {
        TestFixture fixture = new();

        FlowProValidationException exception = await Assert.ThrowsAsync<FlowProValidationException>(
            () => fixture.Handler.HandleAsync(
                CreateCommand("malware.exe", "application/x-msdownload", "nope"),
                CancellationToken.None));

        Assert.Equal("attachments.content-type-not-allowed", exception.Code);
        Assert.Empty(fixture.Repository.Aggregates);
        Assert.Empty(fixture.Outbox.Messages);
    }

    [Fact]
    public async Task Upload_requires_attachment_permission()
    {
        TestFixture fixture = new();
        fixture.PermissionChecker.DeniedPermissions.Add(PermissionKeys.AttachmentsWriteSelf);

        FlowProForbiddenException exception = await Assert.ThrowsAsync<FlowProForbiddenException>(
            () => fixture.Handler.HandleAsync(
                CreateCommand("contract.pdf", "application/pdf", "signed"),
                CancellationToken.None));

        Assert.Equal("attachments.permission-required", exception.Code);
        Assert.Empty(fixture.Repository.Aggregates);
        Assert.Empty(fixture.Outbox.Messages);
    }

    [Fact]
    public async Task Download_returns_owned_attachment_stream()
    {
        TestFixture fixture = new();
        UploadedAttachment uploaded = await fixture.Handler.HandleAsync(
            CreateCommand("contract.pdf", "application/pdf", "signed"),
            CancellationToken.None);

        DownloadedAttachment download = await fixture.Handler.HandleAsync(
            new DownloadAttachmentQuery(uploaded.Id),
            CancellationToken.None);

        Assert.Equal(uploaded.Id, download.Id);
        Assert.Equal("contract.pdf", download.FileName);
        Assert.Equal("application/pdf", download.ContentType);
        Assert.Equal(uploaded.SizeBytes, download.SizeBytes);
        Assert.Equal("sha256", download.Sha256);
        Assert.Equal(fixture.ObjectStore.LastRequest?.ObjectKey, fixture.ObjectStore.LastReadRequest?.ObjectKey);
    }

    [Fact]
    public async Task Download_requires_sync_read_permission()
    {
        TestFixture fixture = new();
        fixture.PermissionChecker.DeniedPermissions.Add(PermissionKeys.SyncReadSelf);

        FlowProForbiddenException exception = await Assert.ThrowsAsync<FlowProForbiddenException>(
            () => fixture.Handler.HandleAsync(
                new DownloadAttachmentQuery("01975fa8-7590-7000-8000-000000003999"),
                CancellationToken.None));

        Assert.Equal("attachments.read-permission-required", exception.Code);
    }

    [Fact]
    public async Task Download_rejects_other_users_attachment()
    {
        TestFixture fixture = new();
        string attachmentId = "01975fa8-7590-7000-8000-000000003999";
        Guid otherUserId = Guid.Parse("01975fa8-7590-7000-8000-000000003003");
        fixture.Repository.Aggregates.Add(
            new ClientAggregate(
                TenantId,
                "attachment",
                attachmentId,
                CreateAttachmentPayload(attachmentId, otherUserId),
                "seed",
                Now,
                otherUserId));

        FlowProForbiddenException exception = await Assert.ThrowsAsync<FlowProForbiddenException>(
            () => fixture.Handler.HandleAsync(
                new DownloadAttachmentQuery(attachmentId),
                CancellationToken.None));

        Assert.Equal("attachments.owner-required", exception.Code);
        Assert.Null(fixture.ObjectStore.LastReadRequest);
    }

    [Fact]
    public async Task Download_returns_not_found_when_storage_object_is_missing()
    {
        TestFixture fixture = new();
        UploadedAttachment uploaded = await fixture.Handler.HandleAsync(
            CreateCommand("contract.pdf", "application/pdf", "signed"),
            CancellationToken.None);
        fixture.ObjectStore.MissingObject = true;

        FlowProNotFoundException exception = await Assert.ThrowsAsync<FlowProNotFoundException>(
            () => fixture.Handler.HandleAsync(
                new DownloadAttachmentQuery(uploaded.Id),
                CancellationToken.None));

        Assert.Equal("attachments.object-not-found", exception.Code);
    }

    [Fact]
    public async Task Delete_soft_deletes_owned_attachment_and_emits_sync_event()
    {
        TestFixture fixture = new();
        UploadedAttachment uploaded = await fixture.Handler.HandleAsync(
            CreateCommand("contract.pdf", "application/pdf", "signed"),
            CancellationToken.None);
        fixture.Outbox.Messages.Clear();

        DeletedAttachment deleted = await fixture.Handler.HandleAsync(
            new DeleteAttachmentCommand(uploaded.Id, "test-client", "test-delete-operation"),
            CancellationToken.None);

        Assert.Equal(uploaded.Id, deleted.Id);
        Assert.Equal(Now, deleted.DeletedAt);
        Assert.Equal(Now.AddDays(180), deleted.PurgeEligibleAt);

        ClientAggregate aggregate = Assert.Single(fixture.Repository.Aggregates);
        Assert.True(aggregate.IsDeleted);
        Assert.Equal("test-delete-operation", aggregate.LastClientOperationId);

        OutboxMessage message = Assert.Single(fixture.Outbox.Messages);
        Assert.Equal("client-aggregate.deleted.v1", message.EventType);
        Assert.Contains("\"deleted\":true", message.PayloadJson, StringComparison.Ordinal);
        Assert.Contains("attachment.delete", message.PayloadJson, StringComparison.Ordinal);
        Assert.Contains("purgeEligibleAt", message.PayloadJson, StringComparison.Ordinal);
        Assert.Contains("\"retentionDays\":180", message.PayloadJson, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Delete_requires_attachment_permission()
    {
        TestFixture fixture = new();
        fixture.PermissionChecker.DeniedPermissions.Add(PermissionKeys.AttachmentsWriteSelf);

        FlowProForbiddenException exception = await Assert.ThrowsAsync<FlowProForbiddenException>(
            () => fixture.Handler.HandleAsync(
                new DeleteAttachmentCommand("01975fa8-7590-7000-8000-000000003999", null, null),
                CancellationToken.None));

        Assert.Equal("attachments.permission-required", exception.Code);
    }

    [Fact]
    public async Task Delete_rejects_other_users_attachment()
    {
        TestFixture fixture = new();
        string attachmentId = "01975fa8-7590-7000-8000-000000003999";
        Guid otherUserId = Guid.Parse("01975fa8-7590-7000-8000-000000003003");
        fixture.Repository.Aggregates.Add(
            new ClientAggregate(
                TenantId,
                "attachment",
                attachmentId,
                CreateAttachmentPayload(attachmentId, otherUserId),
                "seed",
                Now,
                otherUserId));

        FlowProForbiddenException exception = await Assert.ThrowsAsync<FlowProForbiddenException>(
            () => fixture.Handler.HandleAsync(
                new DeleteAttachmentCommand(attachmentId, null, null),
                CancellationToken.None));

        Assert.Equal("attachments.owner-required", exception.Code);
        Assert.False(fixture.Repository.Aggregates.Single().IsDeleted);
        Assert.Empty(fixture.Outbox.Messages);
    }

    private static UploadAttachmentCommand CreateCommand(
        string fileName,
        string contentType,
        string body)
    {
        byte[] bytes = Encoding.UTF8.GetBytes(body);
        return new UploadAttachmentCommand(
            fileName,
            contentType,
            bytes.Length,
            new MemoryStream(bytes),
            "test-client",
            "test-operation");
    }

    private static string CreateAttachmentPayload(string attachmentId, Guid ownerUserId) =>
        JsonSerializer.Serialize(
            new
            {
                id = attachmentId,
                objectKey = $"{TenantId:N}/{ownerUserId:N}/{attachmentId}.pdf",
                fileName = "contract.pdf",
                contentType = "application/pdf",
                sizeBytes = 6,
                sha256 = "sha256",
                storageProvider = "local",
                ownerUserId,
                uploadedAt = Now,
            },
            JsonOptions);

    private sealed class TestFixture
    {
        public TestFixture()
        {
            PermissionChecker = new FakePermissionChecker();
            Repository = new FakeSyncAggregateRepository();
            Outbox = new FakeOutbox();
            ObjectStore = new FakeAttachmentObjectStore();
            Handler = new AttachmentCommandHandler(
                new FakeRequestContext(),
                PermissionChecker,
                ObjectStore,
                Repository,
                Outbox,
                new FakeUnitOfWork(),
                new AttachmentOptions(),
                new FixedTimeProvider());
        }

        public AttachmentCommandHandler Handler { get; }

        public FakePermissionChecker PermissionChecker { get; }

        public FakeSyncAggregateRepository Repository { get; }

        public FakeOutbox Outbox { get; }

        public FakeAttachmentObjectStore ObjectStore { get; }
    }

    private sealed class FakeRequestContext : ICurrentRequestContext
    {
        public RequestIdentity GetRequiredIdentity() => new(TenantId, UserId);

        public RequestIdentity? TryGetIdentity() => GetRequiredIdentity();
    }

    private sealed class FixedTimeProvider : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private sealed class FakeUnitOfWork : IUnitOfWork
    {
        public Task<TResult> ExecuteAsync<TResult>(
            Func<CancellationToken, Task<TResult>> operation,
            CancellationToken cancellationToken) =>
            operation(cancellationToken);
    }

    private sealed class FakeAttachmentObjectStore : IAttachmentObjectStore
    {
        public StoredAttachmentObject? LastRequest { get; private set; }

        public AttachmentObjectReadRequest? LastReadRequest { get; private set; }

        public bool MissingObject { get; set; }

        public Task<StoredAttachmentObject> PutAsync(
            AttachmentObjectWriteRequest request,
            CancellationToken cancellationToken)
        {
            StoredAttachmentObject stored = new(
                $"{request.TenantId:N}/{request.OwnerUserId:N}/{request.AttachmentId}.pdf",
                request.Length,
                "sha256",
                "local");
            LastRequest = stored;
            return Task.FromResult(stored);
        }

        public Task<Stream> OpenReadAsync(
            AttachmentObjectReadRequest request,
            CancellationToken cancellationToken)
        {
            LastReadRequest = request;
            if (MissingObject)
            {
                throw new FileNotFoundException("missing", request.ObjectKey);
            }

            return Task.FromResult<Stream>(new MemoryStream(Encoding.UTF8.GetBytes("signed")));
        }
    }

    private sealed class FakeSyncAggregateRepository : ISyncAggregateRepository
    {
        public List<ClientAggregate> Aggregates { get; } = [];

        public Task<ClientAggregate?> FindAsync(
            Guid tenantId,
            string aggregateType,
            string aggregateId,
            CancellationToken cancellationToken) =>
            Task.FromResult(
                Aggregates.SingleOrDefault(aggregate =>
                    aggregate.TenantId == tenantId
                    && aggregate.AggregateType == aggregateType
                    && aggregate.AggregateId == aggregateId));

        public Task<IReadOnlyList<ClientAggregate>> ListAsync(
            Guid tenantId,
            string aggregateType,
            int offset,
            int limit,
            bool includeDeleted,
            Guid? ownerUserId,
            bool ownerOnly,
            CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<ClientAggregate>>(
                Aggregates
                    .Where(aggregate => aggregate.TenantId == tenantId
                        && aggregate.AggregateType == aggregateType
                        && (includeDeleted || !aggregate.IsDeleted)
                        && (!ownerOnly || aggregate.OwnerUserId == ownerUserId))
                    .Skip(offset)
                    .Take(limit)
                    .ToArray());

        public void Add(ClientAggregate aggregate)
        {
            Aggregates.Add(aggregate);
        }
    }

    private sealed class FakeOutbox : IOutboxWriter
    {
        public List<OutboxMessage> Messages { get; } = [];

        public void Add(OutboxMessage message) => Messages.Add(message);
    }

    private sealed class FakePermissionChecker : IPermissionChecker
    {
        public HashSet<string> DeniedPermissions { get; } = [];

        public Task<bool> HasPermissionAsync(
            Guid tenantId,
            Guid userId,
            string permission,
            CancellationToken cancellationToken) =>
            Task.FromResult(!DeniedPermissions.Contains(permission));
    }
}
