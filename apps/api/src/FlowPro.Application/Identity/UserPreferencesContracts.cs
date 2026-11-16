using FlowPro.Application.Common;

namespace FlowPro.Application.Identity;

public sealed record GetUserPreferencesQuery : IQuery<UserPreferencesDto>;

public sealed record SaveUserPreferencesCommand(
    string Locale,
    string TimeZoneId,
    string WeekStart,
    string DefaultWorkLocation,
    bool DensityCompact,
    bool ShowSyncStatus,
    bool ShowPolicyHints,
    bool FullWidthPages) : ICommand<UserPreferencesDto>;

public sealed record UserPreferencesDto(
    string OwnerUserId,
    string Locale,
    string TimeZoneId,
    string WeekStart,
    string DefaultWorkLocation,
    bool DensityCompact,
    bool ShowSyncStatus,
    bool ShowPolicyHints,
    bool FullWidthPages,
    DateTimeOffset UpdatedAt);
