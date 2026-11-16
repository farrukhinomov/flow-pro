using System.Security.Cryptography;
using FlowPro.Application.Attachments;
using Microsoft.Extensions.Options;

namespace FlowPro.Infrastructure.Attachments;

public sealed class LocalAttachmentObjectStore(
    IOptions<AttachmentStorageOptions> options) : IAttachmentObjectStore
{
    private const string ProviderName = "local";

    public async Task<StoredAttachmentObject> PutAsync(
        AttachmentObjectWriteRequest request,
        CancellationToken cancellationToken)
    {
        AttachmentStorageOptions storageOptions = options.Value;
        EnsureLocalProvider(storageOptions);

        string objectKey = BuildObjectKey(request);
        string fullPath = Path.Combine(
            storageOptions.LocalRootPath,
            objectKey.Replace('/', Path.DirectorySeparatorChar));
        string? directory = Path.GetDirectoryName(fullPath);
        if (string.IsNullOrWhiteSpace(directory))
        {
            throw new InvalidOperationException("Attachment storage path could not be resolved.");
        }

        Directory.CreateDirectory(directory);

        await using FileStream destination = File.Create(fullPath);
        using IncrementalHash hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        byte[] buffer = new byte[128 * 1024];
        long totalBytes = 0;

        while (true)
        {
            int bytesRead = await request.Content.ReadAsync(buffer, cancellationToken);
            if (bytesRead == 0)
            {
                break;
            }

            await destination.WriteAsync(buffer.AsMemory(0, bytesRead), cancellationToken);
            hash.AppendData(buffer.AsSpan(0, bytesRead));
            totalBytes += bytesRead;
        }

        if (totalBytes != request.Length)
        {
            File.Delete(fullPath);
            throw new InvalidOperationException("Attachment upload length did not match the received content.");
        }

        return new StoredAttachmentObject(
            objectKey,
            totalBytes,
            Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant(),
            ProviderName);
    }

    public Task<Stream> OpenReadAsync(
        AttachmentObjectReadRequest request,
        CancellationToken cancellationToken)
    {
        AttachmentStorageOptions storageOptions = options.Value;
        EnsureLocalProvider(storageOptions);

        string rootPath = Path.GetFullPath(storageOptions.LocalRootPath);
        string fullPath = Path.GetFullPath(
            Path.Combine(
                rootPath,
                request.ObjectKey.Replace('/', Path.DirectorySeparatorChar)));

        if (!fullPath.StartsWith(rootPath + Path.DirectorySeparatorChar, StringComparison.Ordinal)
            && !string.Equals(fullPath, rootPath, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Attachment object key resolved outside of the storage root.");
        }

        if (!File.Exists(fullPath))
        {
            throw new FileNotFoundException("Attachment object was not found.", request.ObjectKey);
        }

        Stream stream = File.OpenRead(fullPath);
        return Task.FromResult(stream);
    }

    private static string BuildObjectKey(AttachmentObjectWriteRequest request)
    {
        string extension = Path.GetExtension(request.FileName);
        if (extension.Length > 16)
        {
            extension = string.Empty;
        }

        return string.Join(
            '/',
            request.TenantId.ToString("N"),
            request.OwnerUserId.ToString("N"),
            $"{request.AttachmentId}{extension.ToLowerInvariant()}");
    }

    private static void EnsureLocalProvider(AttachmentStorageOptions storageOptions)
    {
        if (!string.Equals(storageOptions.Provider, "Local", StringComparison.OrdinalIgnoreCase))
        {
            throw new NotSupportedException(
                $"Attachment storage provider '{storageOptions.Provider}' is configured but not implemented in this runtime.");
        }
    }
}
