using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlowPro.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
#pragma warning disable CA1861
public partial class AddAttendancePolicyWorkflows : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.EnsureSchema(
            name: "policies");

        migrationBuilder.CreateTable(
                name: "attendance_policy_versions",
                schema: "policies",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    policy_id = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    version_number = table.Column<int>(type: "integer", nullable: false),
                    config_json = table.Column<string>(type: "jsonb", nullable: false),
                    published_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    published_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    is_current = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_attendance_policy_versions", x => x.id);
                    table.UniqueConstraint("AK_attendance_policy_versions_tenant_id_id", x => new { x.tenant_id, x.id });
                    table.ForeignKey(
                        name: "FK_attendance_policy_versions_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalSchema: "tenancy",
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_attendance_policy_versions_users_tenant_id_published_by_use~",
                        columns: x => new { x.tenant_id, x.published_by_user_id },
                        principalSchema: "identity",
                        principalTable: "users",
                        principalColumns: new[] { "tenant_id", "id" },
                        onDelete: ReferentialAction.Restrict);
                });

        migrationBuilder.CreateIndex(
                name: "IX_attendance_policy_versions_tenant_id_policy_id_is_current",
                schema: "policies",
                table: "attendance_policy_versions",
                columns: new[] { "tenant_id", "policy_id", "is_current" });

        migrationBuilder.CreateIndex(
                name: "IX_attendance_policy_versions_tenant_id_policy_id_version_numb~",
                schema: "policies",
                table: "attendance_policy_versions",
                columns: new[] { "tenant_id", "policy_id", "version_number" },
                unique: true);

        migrationBuilder.CreateIndex(
                name: "IX_attendance_policy_versions_tenant_id_published_by_user_id",
                schema: "policies",
                table: "attendance_policy_versions",
            columns: new[] { "tenant_id", "published_by_user_id" });

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

            ALTER TABLE policies.attendance_policy_versions ENABLE ROW LEVEL SECURITY;

            CREATE POLICY tenant_isolation ON policies.attendance_policy_versions
            USING (tenant_id = infrastructure.current_tenant_id())
            WITH CHECK (tenant_id = infrastructure.current_tenant_id());
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DROP POLICY IF EXISTS tenant_isolation ON policies.attendance_policy_versions;
            """);

        migrationBuilder.DropTable(
            name: "attendance_policy_versions",
            schema: "policies");
    }
}
