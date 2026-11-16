using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlowPro.Infrastructure.Persistence.Migrations;

#pragma warning disable CA1861

/// <inheritdoc />
public partial class AddOrganizationCatalogWorkflows : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "external_id",
            schema: "organization",
            table: "teams",
            type: "character varying(120)",
            maxLength: 120,
            nullable: false,
            defaultValue: "");

        migrationBuilder.AddColumn<Guid>(
            name: "manager_user_id",
            schema: "organization",
            table: "teams",
            type: "uuid",
            nullable: true);

        migrationBuilder.Sql(
            """
                UPDATE organization.teams
                SET external_id = CONCAT(
                    'team-',
                    TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'))),
                    '-',
                    LEFT(id::text, 8))
                WHERE external_id = '';
                """);

        migrationBuilder.CreateTable(
            name: "manager_delegations",
            schema: "organization",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                manager_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                team_id = table.Column<Guid>(type: "uuid", nullable: false),
                is_active = table.Column<bool>(type: "boolean", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                version = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_manager_delegations", x => x.id);
                table.UniqueConstraint("AK_manager_delegations_tenant_id_id", x => new { x.tenant_id, x.id });
                table.ForeignKey(
                    name: "FK_manager_delegations_teams_tenant_id_team_id",
                    columns: x => new { x.tenant_id, x.team_id },
                    principalSchema: "organization",
                    principalTable: "teams",
                    principalColumns: new[] { "tenant_id", "id" },
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "FK_manager_delegations_tenants_tenant_id",
                    column: x => x.tenant_id,
                    principalSchema: "tenancy",
                    principalTable: "tenants",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "FK_manager_delegations_users_tenant_id_manager_user_id",
                    columns: x => new { x.tenant_id, x.manager_user_id },
                    principalSchema: "identity",
                    principalTable: "users",
                    principalColumns: new[] { "tenant_id", "id" },
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "role_profiles",
            schema: "organization",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                external_id = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                label = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                base_role = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                is_active = table.Column<bool>(type: "boolean", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                version = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_role_profiles", x => x.id);
                table.UniqueConstraint("AK_role_profiles_tenant_id_id", x => new { x.tenant_id, x.id });
                table.ForeignKey(
                    name: "FK_role_profiles_tenants_tenant_id",
                    column: x => x.tenant_id,
                    principalSchema: "tenancy",
                    principalTable: "tenants",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "work_patterns",
            schema: "organization",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                external_id = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                label = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                weekly_minutes = table.Column<int>(type: "integer", nullable: false),
                description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                is_active = table.Column<bool>(type: "boolean", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                version = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_work_patterns", x => x.id);
                table.UniqueConstraint("AK_work_patterns_tenant_id_id", x => new { x.tenant_id, x.id });
                table.ForeignKey(
                    name: "FK_work_patterns_tenants_tenant_id",
                    column: x => x.tenant_id,
                    principalSchema: "tenancy",
                    principalTable: "tenants",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_teams_tenant_id_external_id",
            schema: "organization",
            table: "teams",
            columns: new[] { "tenant_id", "external_id" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_teams_tenant_id_manager_user_id",
            schema: "organization",
            table: "teams",
            columns: new[] { "tenant_id", "manager_user_id" });

        migrationBuilder.CreateIndex(
            name: "IX_manager_delegations_tenant_id_manager_user_id_team_id",
            schema: "organization",
            table: "manager_delegations",
            columns: new[] { "tenant_id", "manager_user_id", "team_id" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_manager_delegations_tenant_id_team_id",
            schema: "organization",
            table: "manager_delegations",
            columns: new[] { "tenant_id", "team_id" });

        migrationBuilder.CreateIndex(
            name: "IX_role_profiles_tenant_id_external_id",
            schema: "organization",
            table: "role_profiles",
            columns: new[] { "tenant_id", "external_id" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_work_patterns_tenant_id_external_id",
            schema: "organization",
            table: "work_patterns",
            columns: new[] { "tenant_id", "external_id" },
            unique: true);

        migrationBuilder.AddForeignKey(
            name: "FK_teams_users_tenant_id_manager_user_id",
            schema: "organization",
            table: "teams",
            columns: new[] { "tenant_id", "manager_user_id" },
            principalSchema: "identity",
            principalTable: "users",
            principalColumns: new[] { "tenant_id", "id" },
            onDelete: ReferentialAction.Restrict);

        migrationBuilder.Sql(
            """
                CREATE SCHEMA IF NOT EXISTS infrastructure;

                CREATE OR REPLACE FUNCTION infrastructure.current_tenant_id()
                RETURNS uuid
                LANGUAGE sql
                STABLE
                AS $$
                    SELECT NULLIF(current_setting('flowpro.tenant_id', true), '')::uuid
                $$;
                """);

        migrationBuilder.Sql(
            """
                ALTER TABLE organization.manager_delegations ENABLE ROW LEVEL SECURITY;
                ALTER TABLE organization.role_profiles ENABLE ROW LEVEL SECURITY;
                ALTER TABLE organization.work_patterns ENABLE ROW LEVEL SECURITY;

                CREATE POLICY tenant_isolation ON organization.manager_delegations
                USING (tenant_id = infrastructure.current_tenant_id())
                WITH CHECK (tenant_id = infrastructure.current_tenant_id());

                CREATE POLICY tenant_isolation ON organization.role_profiles
                USING (tenant_id = infrastructure.current_tenant_id())
                WITH CHECK (tenant_id = infrastructure.current_tenant_id());

                CREATE POLICY tenant_isolation ON organization.work_patterns
                USING (tenant_id = infrastructure.current_tenant_id())
                WITH CHECK (tenant_id = infrastructure.current_tenant_id());
                """);

    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "FK_teams_users_tenant_id_manager_user_id",
            schema: "organization",
            table: "teams");

        migrationBuilder.Sql(
            """
                DROP POLICY IF EXISTS tenant_isolation ON organization.manager_delegations;
                DROP POLICY IF EXISTS tenant_isolation ON organization.role_profiles;
                DROP POLICY IF EXISTS tenant_isolation ON organization.work_patterns;
                """);

        migrationBuilder.DropTable(
            name: "manager_delegations",
            schema: "organization");

        migrationBuilder.DropTable(
            name: "role_profiles",
            schema: "organization");

        migrationBuilder.DropTable(
            name: "work_patterns",
            schema: "organization");

        migrationBuilder.DropIndex(
            name: "IX_teams_tenant_id_external_id",
            schema: "organization",
            table: "teams");

        migrationBuilder.DropIndex(
            name: "IX_teams_tenant_id_manager_user_id",
            schema: "organization",
            table: "teams");

        migrationBuilder.DropColumn(
            name: "external_id",
            schema: "organization",
            table: "teams");

        migrationBuilder.DropColumn(
            name: "manager_user_id",
            schema: "organization",
            table: "teams");
    }
}
