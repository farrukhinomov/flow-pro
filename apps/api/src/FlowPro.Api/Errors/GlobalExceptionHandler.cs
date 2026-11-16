using FlowPro.Application.Common;
using FlowPro.Domain.Common;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FlowPro.Api.Errors;

internal sealed partial class GlobalExceptionHandler(
    ILogger<GlobalExceptionHandler> logger,
    IHostEnvironment environment) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        (int status, string code, string title) = exception switch
        {
            FlowProUnauthorizedException unauthorized =>
                (StatusCodes.Status401Unauthorized, unauthorized.Code, "Authentication required"),
            FlowProAuthenticationFailedException failed =>
                (StatusCodes.Status401Unauthorized, failed.Code, "Authentication failed"),
            FlowProForbiddenException forbidden =>
                (StatusCodes.Status403Forbidden, forbidden.Code, "Forbidden"),
            FlowProNotFoundException notFound =>
                (StatusCodes.Status404NotFound, notFound.Code, "Not found"),
            FlowProValidationException validation =>
                (StatusCodes.Status400BadRequest, validation.Code, "Validation failed"),
            FlowProConflictException conflict =>
                (StatusCodes.Status409Conflict, conflict.Code, "Conflict"),
            DomainRuleException domainRule =>
                (StatusCodes.Status409Conflict, domainRule.Code, "Business rule conflict"),
            DbUpdateConcurrencyException =>
                (StatusCodes.Status409Conflict, "concurrency.conflict", "Concurrency conflict"),
            _ =>
                (StatusCodes.Status500InternalServerError, "server.unexpected", "Unexpected server error"),
        };

        if (status >= 500)
        {
            LogUnhandledException(logger, exception, httpContext.TraceIdentifier);
        }
        else
        {
            LogRequestFailure(
                logger,
                exception,
                code,
                httpContext.TraceIdentifier);
        }

        ProblemDetails problem = new()
        {
            Status = status,
            Title = title,
            Detail = status < 500 || environment.IsDevelopment()
                ? exception.Message
                : "The server could not complete the request.",
            Instance = httpContext.Request.Path,
        };
        problem.Extensions["code"] = code;
        problem.Extensions["traceId"] = httpContext.TraceIdentifier;

        httpContext.Response.StatusCode = status;
        await httpContext.Response.WriteAsJsonAsync(problem, cancellationToken);
        return true;
    }

    [LoggerMessage(
        Level = LogLevel.Error,
        Message = "Unhandled exception for trace {TraceId}")]
    private static partial void LogUnhandledException(
        ILogger logger,
        Exception exception,
        string traceId);

    [LoggerMessage(
        Level = LogLevel.Warning,
        Message = "Request failed with {ErrorCode} for trace {TraceId}")]
    private static partial void LogRequestFailure(
        ILogger logger,
        Exception exception,
        string errorCode,
        string traceId);
}
