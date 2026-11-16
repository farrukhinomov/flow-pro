using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlowPro.Infrastructure.Persistence.Migrations;

#pragma warning disable CA1861

/// <inheritdoc />
public partial class AddTimesheetSnapshotWorkflows : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.EnsureSchema(
            name: "timesheets");

        migrationBuilder.CreateTable(
            name: "monthly_snapshots",
            schema: "timesheets",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                employee_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                employee_external_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                period_month = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                signed_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                signed_by_external_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                signed_by_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                signed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                payroll_exported_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                pdf_exported_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                snapshot_json = table.Column<string>(type: "jsonb", nullable: false),
                snapshot_hash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                version = table.Column<long>(type: "bigint", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_monthly_snapshots", x => x.id);
                table.UniqueConstraint("AK_monthly_snapshots_tenant_id_id", x => new { x.tenant_id, x.id });
                table.ForeignKey(
                    name: "FK_monthly_snapshots_tenants_tenant_id",
                    column: x => x.tenant_id,
                    principalSchema: "tenancy",
                    principalTable: "tenants",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "FK_monthly_snapshots_users_tenant_id_employee_user_id",
                    columns: x => new { x.tenant_id, x.employee_user_id },
                    principalSchema: "identity",
                    principalTable: "users",
                    principalColumns: new[] { "tenant_id", "id" },
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "FK_monthly_snapshots_users_tenant_id_signed_by_user_id",
                    columns: x => new { x.tenant_id, x.signed_by_user_id },
                    principalSchema: "identity",
                    principalTable: "users",
                    principalColumns: new[] { "tenant_id", "id" },
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_monthly_snapshots_tenant_id_employee_external_id_period_mon~",
            schema: "timesheets",
            table: "monthly_snapshots",
            columns: new[] { "tenant_id", "employee_external_id", "period_month" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_monthly_snapshots_tenant_id_employee_user_id",
            schema: "timesheets",
            table: "monthly_snapshots",
            columns: new[] { "tenant_id", "employee_user_id" });

        migrationBuilder.CreateIndex(
            name: "IX_monthly_snapshots_tenant_id_signed_by_user_id",
            schema: "timesheets",
            table: "monthly_snapshots",
            columns: new[] { "tenant_id", "signed_by_user_id" });

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

            ALTER TABLE timesheets.monthly_snapshots ENABLE ROW LEVEL SECURITY;

            CREATE POLICY tenant_isolation ON timesheets.monthly_snapshots
            USING (tenant_id = infrastructure.current_tenant_id())
            WITH CHECK (tenant_id = infrastructure.current_tenant_id());
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DROP POLICY IF EXISTS tenant_isolation ON timesheets.monthly_snapshots;
            """);

        migrationBuilder.DropTable(
            name: "monthly_snapshots",
            schema: "timesheets");
    }
}
