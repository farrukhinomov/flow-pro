using System.Text.Json;
using FlowPro.Application.Common;

namespace FlowPro.Application.Planning;

public sealed record GetPlanningPackageQuery(string PeriodMonth) : IQuery<PlanningPackageDto>;

public sealed record PlanningPackageDto(
    string PeriodMonth,
    DateTimeOffset GeneratedAt,
    IReadOnlyList<PlanningPersonDto> People,
    IReadOnlyList<JsonElement> Requests);

public sealed record PlanningPersonDto(
    string Id,
    string Name,
    string DisplayName,
    string Role,
    string Team,
    IReadOnlyList<PlanningEntryDto> Entries,
    PlanningEmployeeDto User);

public sealed record PlanningEntryDto(
    string Date,
    string? Code,
    string? Label,
    string? Color,
    string? Category,
    string Visibility,
    bool IsAnon,
    bool IsPending);

public sealed record PlanningEmployeeDto(
    string Id,
    string FirstName,
    string LastName,
    string Username,
    string Email,
    string PhoneNumber,
    string Status,
    string Role,
    string? RoleProfileId,
    string Team,
    string Manager,
    string WorkPattern,
    string VisibilityScope,
    DateTimeOffset? LastSeenAt,
    DateTimeOffset? NextReviewAt,
    DateTimeOffset? DeactivatedAt,
    string? DeactivatedBy,
    string? DeactivationReason,
    DateTimeOffset? RetentionUntil,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record PlanningWorkflowSnapshot(
    IReadOnlyList<PlanningEmployeeDto> Employees,
    IReadOnlyList<JsonElement> Requests);
