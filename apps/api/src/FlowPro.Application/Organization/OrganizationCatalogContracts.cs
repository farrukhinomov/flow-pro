using FlowPro.Application.Common;

namespace FlowPro.Application.Organization;

public sealed record ListOrganizationCatalogQuery : IQuery<OrganizationCatalogPage>;

public sealed record SaveOrganizationCatalogRecordCommand(
    OrganizationCatalogRecordDto Record) : ICommand<OrganizationCatalogRecordDto>;

public sealed record SetManagerDelegationsCommand(
    string ManagerId,
    IReadOnlyList<string> Teams) : ICommand<ManagerDelegationPage>;

public sealed record OrganizationCatalogPage(
    IReadOnlyList<OrganizationCatalogRecordDto> Items,
    IReadOnlyList<ManagerDelegationDto> Delegations);

public sealed record ManagerDelegationPage(IReadOnlyList<ManagerDelegationDto> Items);

public sealed record OrganizationCatalogRecordDto(
    string Id,
    string Kind,
    string? Code,
    string? Label,
    string? Name,
    string? Description,
    string Status,
    string? BaseRole,
    string? ManagerId,
    string? TimeZoneId,
    double? WeeklyHours,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ManagerDelegationDto(
    string Id,
    string ManagerId,
    string Team,
    bool Active,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
