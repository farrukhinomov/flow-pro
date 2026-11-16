using FlowPro.Application.Attendance;
using FlowPro.Application.Identity;
using FlowPro.Domain.Attendance;

namespace FlowPro.Architecture.Tests;

public sealed class ArchitectureDependencyTests
{
    [Fact]
    public void Domain_has_no_dependency_on_other_FlowPro_projects()
    {
        string[] references = GetFlowProReferences(typeof(AttendanceState).Assembly);

        Assert.Empty(references);
    }

    [Fact]
    public void Application_depends_only_on_Domain()
    {
        string[] references = GetFlowProReferences(typeof(AttendanceCommandHandler).Assembly);

        Assert.Equal(["FlowPro.Domain"], references);
    }

    [Fact]
    public void Infrastructure_does_not_depend_on_Api()
    {
        string[] references = GetFlowProReferences(typeof(Infrastructure.DependencyInjection).Assembly);

        Assert.DoesNotContain("FlowPro.Api", references);
    }

    [Fact]
    public void Operations_health_endpoint_requires_audit_permission()
    {
        string source = File.ReadAllText(GetSourcePath(
            "apps/api/src/FlowPro.Api/Operations/OperationsHealthEndpoints.cs"));

        Assert.Contains("/health", source, StringComparison.Ordinal);
        Assert.Contains(
            $".RequireAuthorization({nameof(PermissionKeys)}.{nameof(PermissionKeys.AuditViewFull)})",
            source,
            StringComparison.Ordinal);
    }

    [Fact]
    public void Onboarding_write_steps_require_organization_management()
    {
        string source = File.ReadAllText(GetSourcePath(
            "apps/api/src/FlowPro.Api/Onboarding/OnboardingEndpoints.cs"));

        foreach (string route in new[] { "/steps/company", "/steps/{step}/resolve", "/complete" })
        {
            Assert.Contains(route, source, StringComparison.Ordinal);
        }

        Assert.Equal(
            3,
            CountOccurrences(
                source,
                $".RequireAuthorization({nameof(PermissionKeys)}.{nameof(PermissionKeys.OrganizationManage)})"));
    }

    [Fact]
    public void Workspace_claim_is_rate_limited_because_it_creates_tenants()
    {
        string source = File.ReadAllText(GetSourcePath(
            "apps/api/src/FlowPro.Api/Onboarding/OnboardingEndpoints.cs"));

        Assert.Contains(".RequireRateLimiting(RateLimitPolicies.WorkspaceClaim)", source, StringComparison.Ordinal);
    }

    private static int CountOccurrences(string source, string value)
    {
        int count = 0;
        int index = source.IndexOf(value, StringComparison.Ordinal);

        while (index >= 0)
        {
            count++;
            index = source.IndexOf(value, index + value.Length, StringComparison.Ordinal);
        }

        return count;
    }

    private static string[] GetFlowProReferences(System.Reflection.Assembly assembly) =>
        assembly
            .GetReferencedAssemblies()
            .Select(reference => reference.Name)
            .Where(name => name is not null && name.StartsWith("FlowPro.", StringComparison.Ordinal))
            .Cast<string>()
            .Order(StringComparer.Ordinal)
            .ToArray();

    private static string GetSourcePath(string relativePath)
    {
        DirectoryInfo? directory = new(AppContext.BaseDirectory);

        while (directory is not null)
        {
            string candidate = Path.Combine(directory.FullName, relativePath);

            if (File.Exists(candidate))
            {
                return candidate;
            }

            directory = directory.Parent;
        }

        throw new FileNotFoundException($"Could not locate repository file '{relativePath}'.");
    }
}
