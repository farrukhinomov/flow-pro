using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlowPro.Infrastructure.Persistence.Migrations;

/// <summary>
/// Puts every tenant-owned table under a forced <c>tenant_isolation</c> policy.
/// </summary>
/// <remarks>
/// <para>
/// Until now the isolation existed only on paper. The migration meant to add policies to the core
/// tables (<c>AddTenantRowLevelSecurity</c>, now removed) had no <c>[Migration]</c> attribute, so EF
/// never ran it, and the tables that did get a policy only enabled it. PostgreSQL does not apply an
/// enabled policy to the tables' owner unless it is forced, and never to a superuser, which is why
/// the application now connects as an ordinary role that owns the database.
/// </para>
/// <para>
/// A row is visible when its tenant matches <c>flowpro.tenant_id</c>, which the connection sets
/// for the signed-in member, or when the code has explicitly entered the cross-tenant scope
/// (<c>flowpro.scope = 'cross-tenant'</c>) for the few lookups that must span workspaces, such as
/// finding an account's memberships at sign-in.
/// </para>
/// </remarks>
public partial class EnforceTenantRowLevelSecurity : Migration
{
    private static readonly (string Schema, string Table, string TenantColumn)[] TenantTables =
    [
        ("attendance", "attendance_states", "tenant_id"),
        ("attendance", "time_bookings", "tenant_id"),
        ("audit", "audit_events", "tenant_id"),
        ("identity", "membership_invitations", "tenant_id"),
        ("identity", "role_permissions", "tenant_id"),
        ("identity", "roles", "tenant_id"),
        ("identity", "user_preferences", "tenant_id"),
        ("identity", "user_roles", "tenant_id"),
        ("identity", "users", "tenant_id"),
        ("infrastructure", "client_aggregates", "tenant_id"),
        ("infrastructure", "outbox_messages", "tenant_id"),
        ("notifications", "notification_preferences", "tenant_id"),
        ("notifications", "notifications", "tenant_id"),
        ("onboarding", "tenant_onboardings", "tenant_id"),
        ("organization", "departments", "tenant_id"),
        ("organization", "employees", "tenant_id"),
        ("organization", "employment_contracts", "tenant_id"),
        ("organization", "locations", "tenant_id"),
        ("organization", "manager_delegations", "tenant_id"),
        ("organization", "role_profiles", "tenant_id"),
        ("organization", "teams", "tenant_id"),
        ("organization", "work_patterns", "tenant_id"),
        ("policies", "attendance_policy_versions", "tenant_id"),
        ("tenancy", "tenants", "id"),
        ("timesheets", "monthly_snapshots", "tenant_id"),
    ];

    // The tables that had an enabled (not forced) policy before this migration, restored on Down.
    private static readonly string[] PreviouslyEnabled =
    [
        "identity.user_preferences",
        "notifications.notification_preferences",
        "notifications.notifications",
        "onboarding.tenant_onboardings",
        "organization.manager_delegations",
        "organization.role_profiles",
        "organization.work_patterns",
        "policies.attendance_policy_versions",
        "timesheets.monthly_snapshots",
    ];

    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            CREATE OR REPLACE FUNCTION infrastructure.current_tenant_id()
            RETURNS uuid
            LANGUAGE sql
            STABLE
            AS $$
                SELECT NULLIF(current_setting('flowpro.tenant_id', true), '')::uuid
            $$;

            CREATE OR REPLACE FUNCTION infrastructure.is_cross_tenant_scope()
            RETURNS boolean
            LANGUAGE sql
            STABLE
            AS $$
                SELECT COALESCE(current_setting('flowpro.scope', true), '') = 'cross-tenant'
            $$;
            """);

        foreach ((string schema, string table, string tenantColumn) in TenantTables)
        {
            migrationBuilder.Sql(
                $$"""
                ALTER TABLE "{{schema}}"."{{table}}" ENABLE ROW LEVEL SECURITY;
                ALTER TABLE "{{schema}}"."{{table}}" FORCE ROW LEVEL SECURITY;

                DROP POLICY IF EXISTS tenant_isolation ON "{{schema}}"."{{table}}";

                CREATE POLICY tenant_isolation ON "{{schema}}"."{{table}}"
                USING ("{{tenantColumn}}" = infrastructure.current_tenant_id() OR infrastructure.is_cross_tenant_scope())
                WITH CHECK ("{{tenantColumn}}" = infrastructure.current_tenant_id() OR infrastructure.is_cross_tenant_scope());
                """);
        }
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        foreach ((string schema, string table, string tenantColumn) in TenantTables)
        {
            string qualified = $"{schema}.{table}";
            migrationBuilder.Sql(
                PreviouslyEnabled.Contains(qualified)
                    ? $$"""
                        ALTER TABLE "{{schema}}"."{{table}}" NO FORCE ROW LEVEL SECURITY;
                        DROP POLICY IF EXISTS tenant_isolation ON "{{schema}}"."{{table}}";
                        CREATE POLICY tenant_isolation ON "{{schema}}"."{{table}}"
                        USING ("{{tenantColumn}}" = infrastructure.current_tenant_id())
                        WITH CHECK ("{{tenantColumn}}" = infrastructure.current_tenant_id());
                        """
                    : $$"""
                        DROP POLICY IF EXISTS tenant_isolation ON "{{schema}}"."{{table}}";
                        ALTER TABLE "{{schema}}"."{{table}}" NO FORCE ROW LEVEL SECURITY;
                        ALTER TABLE "{{schema}}"."{{table}}" DISABLE ROW LEVEL SECURITY;
                        """);
        }

        migrationBuilder.Sql("DROP FUNCTION IF EXISTS infrastructure.is_cross_tenant_scope();");
    }
}
