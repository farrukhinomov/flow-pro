using FlowPro.Application.Attachments;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;

namespace FlowPro.Api.Modules;

internal static class AttachmentFileEndpoints
{
    public static IEndpointRouteBuilder MapAttachmentFileEndpoints(this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder group = endpoints
            .MapGroup("/api/v1/attachments/files")
            .WithTags("Attachments");

        group.MapPost(
                "",
                async (
                    HttpRequest request,
                    ICommandHandler<UploadAttachmentCommand, UploadedAttachment> handler,
                    CancellationToken cancellationToken) =>
                {
                    if (!request.HasFormContentType)
                    {
                        return Results.ValidationProblem(
                            new Dictionary<string, string[]>
                            {
                                ["file"] = ["Multipart form data is required."],
                            });
                    }

                    IFormCollection form = await request.ReadFormAsync(cancellationToken);
                    IFormFile? file = form.Files.GetFile("file");
                    if (file is null)
                    {
                        return Results.ValidationProblem(
                            new Dictionary<string, string[]>
                            {
                                ["file"] = ["A file field named 'file' is required."],
                            });
                    }

                    await using Stream content = file.OpenReadStream();
                    UploadedAttachment uploaded = await handler.HandleAsync(
                        new UploadAttachmentCommand(
                            file.FileName,
                            file.ContentType,
                            file.Length,
                            content,
                            form["clientId"].FirstOrDefault(),
                            form["clientOperationId"].FirstOrDefault()),
                        cancellationToken);

                    return Results.Ok(uploaded);
                })
            .DisableAntiforgery()
            .RequireAuthorization(PermissionKeys.AttachmentsWriteSelf);

        group.MapGet(
                "{attachmentId}",
                async (
                    string attachmentId,
                    IQueryHandler<DownloadAttachmentQuery, DownloadedAttachment> handler,
                    CancellationToken cancellationToken) =>
                {
                    DownloadedAttachment download = await handler.HandleAsync(
                        new DownloadAttachmentQuery(attachmentId),
                        cancellationToken);

                    return Results.File(
                        download.Content,
                        download.ContentType,
                        download.FileName,
                        enableRangeProcessing: true);
                })
            .RequireAuthorization(PermissionKeys.SyncReadSelf);

        group.MapDelete(
                "{attachmentId}",
                (
                    string attachmentId,
                    string? clientId,
                    string? clientOperationId,
                    ICommandHandler<DeleteAttachmentCommand, DeletedAttachment> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new DeleteAttachmentCommand(
                            attachmentId,
                            clientId,
                            clientOperationId),
                        cancellationToken))
            .RequireAuthorization(PermissionKeys.AttachmentsWriteSelf);

        return endpoints;
    }
}
