using System.Text.Json;
using FlowPro.Application.Common;

namespace FlowPro.Application.Policies;

/// <summary>
/// Reads the policy governing a point in time.
/// </summary>
/// <param name="At">
/// Defaults to now. Supplying a past date answers "which rules governed this
/// period", which is the question an audit of a historic timesheet asks.
/// </param>
public sealed record GetAttendancePolicyConfigQuery(
    string PolicyId = "default",
    DateTimeOffset? At = null) : IQuery<JsonElement?>;

/// <summary>Every published revision of a policy, newest first.</summary>
public sealed record GetAttendancePolicyHistoryQuery(
    string PolicyId = "default")
    : IQuery<IReadOnlyList<AttendancePolicyVersionDto>>;

/// <summary>
/// Publishes a revision.
/// </summary>
/// <param name="EffectiveFrom">
/// When the rules start applying. Defaults to now. A future date schedules the
/// change without disturbing the policy that governs today.
/// </param>
public sealed record PublishAttendancePolicyConfigCommand(
    string PolicyId,
    JsonElement Config,
    DateTimeOffset? EffectiveFrom = null) : ICommand<JsonElement>;

public sealed record AttendancePolicyVersionDto(
    string Id,
    string PolicyId,
    int VersionNumber,
    DateTimeOffset PublishedAt,
    DateTimeOffset EffectiveFrom,
    bool IsLatestPublished,
    bool IsInEffect,
    string ConfigHash);
