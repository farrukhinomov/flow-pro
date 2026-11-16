using System.Security.Claims;
using FlowPro.Application.Accounts;
using FlowPro.Application.Common;

namespace FlowPro.Api.Authentication;

internal static class AccountEndpoints
{
    public static IEndpointRouteBuilder MapAccountEndpoints(this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder group = endpoints
            .MapGroup("/api/v1/auth")
            .WithTags("Authentication");

        group.MapPost(
                "/register",
                async (
                    RegisterAccountRequest request,
                    HttpContext httpContext,
                    SessionCookie cookie,
                    ICommandHandler<RegisterAccountCommand, IssuedSession> handler,
                    CancellationToken cancellationToken) =>
                {
                    IssuedSession session = await handler.HandleAsync(
                        new RegisterAccountCommand(
                            request.Email ?? string.Empty,
                            request.Password ?? string.Empty,
                            request.DisplayName ?? string.Empty,
                            ReadClient(httpContext)),
                        cancellationToken);

                    return SignedIn(httpContext, cookie, session, StatusCodes.Status201Created);
                })
            .AllowAnonymous()
            .RequireRateLimiting(RateLimitPolicies.AccountRegistration);

        group.MapPost(
                "/sign-in",
                async (
                    SignInRequest request,
                    HttpContext httpContext,
                    SessionCookie cookie,
                    TwoFactorChallengeCookie challengeCookie,
                    ICommandHandler<SignInCommand, SignInOutcome> handler,
                    CancellationToken cancellationToken) =>
                {
                    SignInOutcome outcome = await handler.HandleAsync(
                        new SignInCommand(
                            request.Email ?? string.Empty,
                            request.Password ?? string.Empty,
                            ReadClient(httpContext)),
                        cancellationToken);

                    if (outcome.Challenge is { } challenge)
                    {
                        // The password was right; the session comes after the code.
                        challengeCookie.Write(httpContext.Response, challenge.Token, challenge.ExpiresAt);
                        PreventCaching(httpContext);
                        return Results.Json(
                            new TwoFactorRequiredResponse(TwoFactorRequired: true),
                            statusCode: StatusCodes.Status202Accepted);
                    }

                    return SignedIn(httpContext, cookie, outcome.Session!, StatusCodes.Status200OK);
                })
            .AllowAnonymous()
            .RequireRateLimiting(RateLimitPolicies.SignIn);

        group.MapPost(
                "/sign-in/two-factor",
                async (
                    TwoFactorCodeRequest request,
                    HttpContext httpContext,
                    SessionCookie cookie,
                    TwoFactorChallengeCookie challengeCookie,
                    ICommandHandler<CompleteTwoFactorSignInCommand, IssuedSession> handler,
                    CancellationToken cancellationToken) =>
                {
                    IssuedSession session = await handler.HandleAsync(
                        new CompleteTwoFactorSignInCommand(
                            challengeCookie.Read(httpContext.Request),
                            request.Code ?? string.Empty,
                            ReadClient(httpContext)),
                        cancellationToken);

                    challengeCookie.Clear(httpContext.Response);
                    return SignedIn(httpContext, cookie, session, StatusCodes.Status200OK);
                })
            .AllowAnonymous()
            .RequireRateLimiting(RateLimitPolicies.SignIn);

        // Anonymous on purpose: signing out with an expired or missing session still succeeds, so
        // the client can always clear its state.
        group.MapPost(
                "/sign-out",
                async (
                    HttpContext httpContext,
                    SessionCookie cookie,
                    ICommandHandler<SignOutCommand, SignedOut> handler,
                    CancellationToken cancellationToken) =>
                {
                    await handler.HandleAsync(
                        new SignOutCommand(cookie.Read(httpContext.Request), ReadClient(httpContext)),
                        cancellationToken);
                    cookie.Clear(httpContext.Response);
                    PreventCaching(httpContext);

                    return Results.NoContent();
                })
            .AllowAnonymous();

        group.MapPost(
                "/password/forgot",
                async (
                    ForgotPasswordRequest request,
                    HttpContext httpContext,
                    ICommandHandler<RequestPasswordResetCommand, EmailRequestAccepted> handler,
                    CancellationToken cancellationToken) =>
                {
                    await handler.HandleAsync(
                        new RequestPasswordResetCommand(request.Email ?? string.Empty, ReadClient(httpContext)),
                        cancellationToken);

                    // The same answer for every email, so this cannot be used to find accounts.
                    return Results.Accepted();
                })
            .AllowAnonymous()
            .RequireRateLimiting(RateLimitPolicies.AccountEmail);

        group.MapPost(
                "/password/reset",
                async (
                    ResetPasswordRequest request,
                    HttpContext httpContext,
                    SessionCookie cookie,
                    ICommandHandler<ResetPasswordCommand, PasswordResetCompleted> handler,
                    CancellationToken cancellationToken) =>
                {
                    await handler.HandleAsync(
                        new ResetPasswordCommand(
                            request.Token ?? string.Empty,
                            request.Password ?? string.Empty,
                            ReadClient(httpContext)),
                        cancellationToken);

                    // Every session of the account has ended, this browser's included.
                    cookie.Clear(httpContext.Response);
                    PreventCaching(httpContext);
                    return Results.NoContent();
                })
            .AllowAnonymous()
            .RequireRateLimiting(RateLimitPolicies.SignIn);

        group.MapPost(
                "/email/verify",
                async (
                    VerifyEmailRequest request,
                    HttpContext httpContext,
                    ICommandHandler<VerifyEmailCommand, EmailVerificationCompleted> handler,
                    CancellationToken cancellationToken) =>
                {
                    await handler.HandleAsync(
                        new VerifyEmailCommand(request.Token ?? string.Empty, ReadClient(httpContext)),
                        cancellationToken);

                    return Results.NoContent();
                })
            .AllowAnonymous()
            .RequireRateLimiting(RateLimitPolicies.SignIn);

        group.MapPost(
                "/email/change",
                async (
                    ChangeEmailRequest request,
                    HttpContext httpContext,
                    ICommandHandler<ChangeEmailCommand, EmailRequestAccepted> handler,
                    CancellationToken cancellationToken) =>
                {
                    await handler.HandleAsync(
                        new ChangeEmailCommand(
                            ReadCaller(httpContext),
                            request.CurrentPassword ?? string.Empty,
                            request.NewEmail ?? string.Empty,
                            ReadClient(httpContext)),
                        cancellationToken);

                    return Results.Accepted();
                })
            .RequireAuthorization()
            .RequireRateLimiting(RateLimitPolicies.AccountEmail);

        group.MapPost(
                "/email/change/confirm",
                async (
                    VerifyEmailRequest request,
                    HttpContext httpContext,
                    ICommandHandler<ConfirmEmailChangeCommand, EmailChangeCompleted> handler,
                    CancellationToken cancellationToken) =>
                {
                    EmailChangeCompleted result = await handler.HandleAsync(
                        new ConfirmEmailChangeCommand(request.Token ?? string.Empty, ReadClient(httpContext)),
                        cancellationToken);

                    return Results.Ok(result);
                })
            .AllowAnonymous()
            .RequireRateLimiting(RateLimitPolicies.SignIn);

        group.MapPost(
                "/email/verification",
                async (
                    HttpContext httpContext,
                    ICurrentPrincipal currentPrincipal,
                    ICommandHandler<ResendEmailVerificationCommand, EmailRequestAccepted> handler,
                    CancellationToken cancellationToken) =>
                {
                    Guid accountId = currentPrincipal.GetRequiredPrincipal().AccountId
                        ?? throw new FlowProForbiddenException(
                            "account.session_required",
                            "Only a signed-in account can ask for a confirmation email.");

                    await handler.HandleAsync(
                        new ResendEmailVerificationCommand(accountId, ReadClient(httpContext)),
                        cancellationToken);

                    return Results.Accepted();
                })
            .RequireAuthorization()
            .RequireRateLimiting(RateLimitPolicies.AccountEmail);

        group.MapGet(
                "/account",
                async (
                    HttpContext httpContext,
                    IQueryHandler<GetAccountOverviewQuery, AccountOverview> handler,
                    CancellationToken cancellationToken) =>
                {
                    AccountOverview overview = await handler.HandleAsync(
                        new GetAccountOverviewQuery(ReadCaller(httpContext)),
                        cancellationToken);
                    PreventCaching(httpContext);

                    return Results.Ok(overview);
                })
            .RequireAuthorization();

        group.MapPost(
                "/invitation/preview",
                async (
                    InvitationTokenRequest request,
                    HttpContext httpContext,
                    IQueryHandler<PreviewInvitationQuery, InvitationPreview> handler,
                    CancellationToken cancellationToken) =>
                {
                    InvitationPreview preview = await handler.HandleAsync(
                        new PreviewInvitationQuery(request.Token ?? string.Empty),
                        cancellationToken);

                    PreventCaching(httpContext);
                    return Results.Ok(preview);
                })
            .AllowAnonymous()
            .RequireRateLimiting(RateLimitPolicies.SignIn);

        group.MapPost(
                "/invitation/accept",
                async (
                    InvitationTokenRequest request,
                    HttpContext httpContext,
                    ICommandHandler<AcceptInvitationCommand, InvitationAccepted> handler,
                    CancellationToken cancellationToken) =>
                {
                    InvitationAccepted accepted = await handler.HandleAsync(
                        new AcceptInvitationCommand(
                            request.Token ?? string.Empty,
                            ReadCaller(httpContext),
                            ReadClient(httpContext)),
                        cancellationToken);

                    return Results.Ok(accepted);
                })
            .RequireAuthorization()
            .RequireRateLimiting(RateLimitPolicies.SignIn);

        group.MapPost(
                "/invitation/accept-new",
                async (
                    AcceptInvitationWithNewAccountRequest request,
                    HttpContext httpContext,
                    SessionCookie cookie,
                    ICommandHandler<AcceptInvitationWithNewAccountCommand, IssuedSession> handler,
                    CancellationToken cancellationToken) =>
                {
                    IssuedSession session = await handler.HandleAsync(
                        new AcceptInvitationWithNewAccountCommand(
                            request.Token ?? string.Empty,
                            request.DisplayName ?? string.Empty,
                            request.Password ?? string.Empty,
                            ReadClient(httpContext)),
                        cancellationToken);

                    return SignedIn(httpContext, cookie, session, StatusCodes.Status201Created);
                })
            .AllowAnonymous()
            .RequireRateLimiting(RateLimitPolicies.AccountRegistration);

        group.MapGet(
                "/workspaces",
                async (
                    HttpContext httpContext,
                    IQueryHandler<ListWorkspacesQuery, WorkspaceList> handler,
                    CancellationToken cancellationToken) =>
                {
                    WorkspaceList workspaces = await handler.HandleAsync(
                        new ListWorkspacesQuery(ReadCaller(httpContext)),
                        cancellationToken);

                    PreventCaching(httpContext);
                    return Results.Ok(workspaces);
                })
            .RequireAuthorization();

        group.MapPost(
                "/workspace",
                async (
                    SwitchWorkspaceRequest request,
                    HttpContext httpContext,
                    ICommandHandler<SwitchWorkspaceCommand, WorkspaceSwitched> handler,
                    CancellationToken cancellationToken) =>
                {
                    await handler.HandleAsync(
                        new SwitchWorkspaceCommand(ReadCaller(httpContext), request.TenantId ?? Guid.Empty),
                        cancellationToken);

                    return Results.NoContent();
                })
            .RequireAuthorization();

        group.MapPost(
                "/password/change",
                async (
                    ChangePasswordRequest request,
                    HttpContext httpContext,
                    ICommandHandler<ChangePasswordCommand, PasswordChanged> handler,
                    CancellationToken cancellationToken) =>
                {
                    PasswordChanged result = await handler.HandleAsync(
                        new ChangePasswordCommand(
                            ReadCaller(httpContext),
                            request.CurrentPassword ?? string.Empty,
                            request.NewPassword ?? string.Empty,
                            ReadClient(httpContext)),
                        cancellationToken);

                    return Results.Ok(result);
                })
            .RequireAuthorization()
            .RequireRateLimiting(RateLimitPolicies.SignIn);

        group.MapPost(
                "/two-factor/setup",
                async (
                    CurrentPasswordRequest request,
                    HttpContext httpContext,
                    ICommandHandler<StartAuthenticatorSetupCommand, AuthenticatorSetup> handler,
                    CancellationToken cancellationToken) =>
                {
                    AuthenticatorSetup setup = await handler.HandleAsync(
                        new StartAuthenticatorSetupCommand(
                            ReadCaller(httpContext),
                            request.CurrentPassword ?? string.Empty,
                            ReadClient(httpContext)),
                        cancellationToken);

                    PreventCaching(httpContext);
                    return Results.Ok(setup);
                })
            .RequireAuthorization()
            .RequireRateLimiting(RateLimitPolicies.SignIn);

        group.MapPost(
                "/two-factor/enable",
                async (
                    TwoFactorCodeRequest request,
                    HttpContext httpContext,
                    ICommandHandler<EnableTwoFactorCommand, TwoFactorEnabled> handler,
                    CancellationToken cancellationToken) =>
                {
                    TwoFactorEnabled enabled = await handler.HandleAsync(
                        new EnableTwoFactorCommand(
                            ReadCaller(httpContext),
                            request.Code ?? string.Empty,
                            ReadClient(httpContext)),
                        cancellationToken);

                    PreventCaching(httpContext);
                    return Results.Ok(enabled);
                })
            .RequireAuthorization()
            .RequireRateLimiting(RateLimitPolicies.SignIn);

        group.MapPost(
                "/two-factor/disable",
                async (
                    CurrentPasswordRequest request,
                    HttpContext httpContext,
                    ICommandHandler<DisableTwoFactorCommand, TwoFactorDisabled> handler,
                    CancellationToken cancellationToken) =>
                {
                    await handler.HandleAsync(
                        new DisableTwoFactorCommand(
                            ReadCaller(httpContext),
                            request.CurrentPassword ?? string.Empty,
                            ReadClient(httpContext)),
                        cancellationToken);

                    return Results.NoContent();
                })
            .RequireAuthorization()
            .RequireRateLimiting(RateLimitPolicies.SignIn);

        group.MapPost(
                "/two-factor/recovery-codes",
                async (
                    CurrentPasswordRequest request,
                    HttpContext httpContext,
                    ICommandHandler<RegenerateRecoveryCodesCommand, RecoveryCodesIssued> handler,
                    CancellationToken cancellationToken) =>
                {
                    RecoveryCodesIssued issued = await handler.HandleAsync(
                        new RegenerateRecoveryCodesCommand(
                            ReadCaller(httpContext),
                            request.CurrentPassword ?? string.Empty,
                            ReadClient(httpContext)),
                        cancellationToken);

                    PreventCaching(httpContext);
                    return Results.Ok(issued);
                })
            .RequireAuthorization()
            .RequireRateLimiting(RateLimitPolicies.SignIn);

        group.MapDelete(
                "/sessions/{sessionId:guid}",
                async (
                    Guid sessionId,
                    HttpContext httpContext,
                    ICommandHandler<RevokeSessionCommand, SessionsRevoked> handler,
                    CancellationToken cancellationToken) =>
                {
                    await handler.HandleAsync(
                        new RevokeSessionCommand(ReadCaller(httpContext), sessionId, ReadClient(httpContext)),
                        cancellationToken);

                    return Results.NoContent();
                })
            .RequireAuthorization();

        group.MapPost(
                "/sessions/revoke-others",
                async (
                    HttpContext httpContext,
                    ICommandHandler<RevokeOtherSessionsCommand, SessionsRevoked> handler,
                    CancellationToken cancellationToken) =>
                {
                    SessionsRevoked result = await handler.HandleAsync(
                        new RevokeOtherSessionsCommand(ReadCaller(httpContext), ReadClient(httpContext)),
                        cancellationToken);

                    return Results.Ok(result);
                })
            .RequireAuthorization();

        return endpoints;
    }

    /// <summary>
    /// The account and session behind a request authenticated by <see cref="SessionAuthenticationHandler" />.
    /// </summary>
    private static AccountCaller ReadCaller(HttpContext httpContext)
    {
        ClaimsPrincipal user = httpContext.User;

        return Guid.TryParse(user.FindFirstValue("sub"), out Guid accountId)
            && Guid.TryParse(user.FindFirstValue(FlowProClaimTypes.SessionId), out Guid sessionId)
                ? new AccountCaller(accountId, sessionId)
                : throw new FlowProUnauthorizedException();
    }

    private static IResult SignedIn(
        HttpContext httpContext,
        SessionCookie cookie,
        IssuedSession session,
        int statusCode)
    {
        cookie.Write(httpContext.Response, session.Token, session.ExpiresAt);
        PreventCaching(httpContext);

        // The token goes to the browser as an HttpOnly cookie only. It is never in the body.
        return Results.Json(
            new AccountResponse(session.AccountId, session.Email, session.DisplayName),
            statusCode: statusCode);
    }

    private static ClientContext ReadClient(HttpContext httpContext) =>
        new(
            httpContext.Connection.RemoteIpAddress?.ToString(),
            httpContext.Request.Headers.UserAgent.ToString());

    private static void PreventCaching(HttpContext httpContext) =>
        httpContext.Response.Headers.CacheControl = "no-store";
}

internal sealed record RegisterAccountRequest(string? Email, string? Password, string? DisplayName);

internal sealed record SignInRequest(string? Email, string? Password);

internal sealed record TwoFactorRequiredResponse(bool TwoFactorRequired);

internal sealed record TwoFactorCodeRequest(string? Code);

internal sealed record CurrentPasswordRequest(string? CurrentPassword);

internal sealed record ForgotPasswordRequest(string? Email);

internal sealed record ResetPasswordRequest(string? Token, string? Password);

internal sealed record VerifyEmailRequest(string? Token);

internal sealed record ChangePasswordRequest(string? CurrentPassword, string? NewPassword);

internal sealed record ChangeEmailRequest(string? CurrentPassword, string? NewEmail);

internal sealed record SwitchWorkspaceRequest(Guid? TenantId);

internal sealed record InvitationTokenRequest(string? Token);

internal sealed record AcceptInvitationWithNewAccountRequest(string? Token, string? DisplayName, string? Password);

internal sealed record AccountResponse(Guid AccountId, string Email, string DisplayName);
