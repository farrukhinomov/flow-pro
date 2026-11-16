using System.Text.Json;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Policies;

namespace FlowPro.Api.Policies;

internal static class AttendancePolicyWorkflowEndpoints
{
    public static IEndpointRouteBuilder MapAttendancePolicyWorkflowEndpoints(this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder group = endpoints
            .MapGroup("/api/v1/attendance-policy-workflows")
            .WithTags("Attendance Policy Workflows");

        group.MapGet(
                "/{policyId}",
                async Task<IResult> (
                    string policyId,
                    DateTimeOffset? at,
                    IQueryHandler<GetAttendancePolicyConfigQuery, JsonElement?> handler,
                    CancellationToken cancellationToken) =>
                {
                    // `at` answers "which rules governed this period". Omitted,
                    // it resolves to the policy in effect now.
                    JsonElement? config = await handler.HandleAsync(
                        new GetAttendancePolicyConfigQuery(policyId, at),
                        cancellationToken);

                    return config is { } value
                        ? Results.Ok(value)
                        : Results.NoContent();
                })
            .RequireAuthorization();

        group.MapGet(
                "/{policyId}/history",
                (
                    string policyId,
                    IQueryHandler<GetAttendancePolicyHistoryQuery, IReadOnlyList<AttendancePolicyVersionDto>> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new GetAttendancePolicyHistoryQuery(policyId),
                        cancellationToken))
            .RequireAuthorization(PermissionKeys.AttendancePolicyManage);

        group.MapPut(
                "/{policyId}",
                (
                    string policyId,
                    DateTimeOffset? effectiveFrom,
                    JsonElement request,
                    ICommandHandler<PublishAttendancePolicyConfigCommand, JsonElement> handler,
                    CancellationToken cancellationToken) =>
                    handler.HandleAsync(
                        new PublishAttendancePolicyConfigCommand(
                            policyId,
                            request,
                            effectiveFrom),
                        cancellationToken))
            .RequireAuthorization(PermissionKeys.AttendancePolicyManage);

        return endpoints;
    }
}
