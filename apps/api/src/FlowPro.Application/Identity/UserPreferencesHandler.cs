using System.Text.Json;
using FlowPro.Application.Audit;
using FlowPro.Application.Common;
using FlowPro.Application.Integration;
using FlowPro.Domain.Audit;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Integration;

namespace FlowPro.Application.Identity;

/// <summary>
/// Reads and writes the signed-in user's own interface preferences.
/// </summary>
/// <remarks>
/// Scoped to the caller by construction: both operations resolve the owner from
/// the authenticated identity and never accept a user id from the request, so
/// there is no way to read or overwrite another user's preferences.
/// </remarks>
public sealed class UserPreferencesHandler(
    ICurrentRequestContext requestContext,
    IUserPreferencesRepository repository,
    IAuditWriter auditWriter,
    IOutboxWriter outboxWriter,
    IUnitOfWork unitOfWork,
    TimeProvider timeProvider) :
    IQueryHandler<GetUserPreferencesQuery, UserPreferencesDto>,
    ICommandHandler<SaveUserPreferencesCommand, UserPreferencesDto>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<UserPreferencesDto> HandleAsync(
        GetUserPreferencesQuery query,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        Membership user = await GetCurrentUserAsync(identity, cancellationToken);
        UserPreferencesRecord? preferences = await repository.FindPreferencesAsync(
            identity.TenantId,
            identity.UserId,
            cancellationToken);

        // A user who has never saved preferences reads the defaults rather than
        // a 404, so the settings page has something to render on first visit
        // without writing a row it may never need.
        return preferences is null
            ? Map(new UserPreferencesRecord(identity.TenantId, identity.UserId), user)
            : Map(preferences, user);
    }

    public async Task<UserPreferencesDto> HandleAsync(
        SaveUserPreferencesCommand command,
        CancellationToken cancellationToken)
    {
        RequestIdentity identity = requestContext.GetRequiredIdentity();
        Membership user = await GetCurrentUserAsync(identity, cancellationToken);

        return await unitOfWork.ExecuteAsync(
            async transactionCancellationToken =>
            {
                UserPreferencesRecord? preferences = await repository.FindPreferencesAsync(
                    identity.TenantId,
                    identity.UserId,
                    transactionCancellationToken);

                if (preferences is null)
                {
                    preferences = new UserPreferencesRecord(identity.TenantId, identity.UserId);
                    repository.AddPreferences(preferences);
                }

                preferences.Update(
                    command.Locale,
                    command.TimeZoneId,
                    command.WeekStart,
                    command.DefaultWorkLocation,
                    command.DensityCompact,
                    command.ShowSyncStatus,
                    command.ShowPolicyHints,
                    command.FullWidthPages);

                UserPreferencesDto dto = Map(preferences, user);
                AddAuditAndOutbox(identity, dto, timeProvider.GetUtcNow());

                return dto;
            },
            cancellationToken);
    }

    private void AddAuditAndOutbox(
        RequestIdentity identity,
        UserPreferencesDto payload,
        DateTimeOffset now)
    {
        const string eventType = "user.preferences.saved.v1";
        string payloadJson = JsonSerializer.Serialize(payload, JsonOptions);

        outboxWriter.Add(
            new OutboxMessage(
                identity.TenantId,
                eventType,
                "user-preferences",
                identity.UserId,
                payloadJson,
                now));
        auditWriter.Add(
            new AuditEvent(
                identity.TenantId,
                identity.UserId,
                eventType,
                "user-preferences",
                identity.UserId,
                payloadJson,
                now));
    }

    private async Task<Membership> GetCurrentUserAsync(
        RequestIdentity identity,
        CancellationToken cancellationToken) =>
        await repository.FindUserByIdAsync(identity.TenantId, identity.UserId, cancellationToken)
        ?? throw new FlowProUnauthorizedException();

    private static UserPreferencesDto Map(UserPreferencesRecord preferences, Membership user) =>
        new(
            user.ExternalSubject,
            preferences.Locale,
            preferences.TimeZoneId,
            preferences.WeekStart,
            preferences.DefaultWorkLocation,
            preferences.DensityCompact,
            preferences.ShowSyncStatus,
            preferences.ShowPolicyHints,
            preferences.FullWidthPages,
            preferences.UpdatedAt);
}
