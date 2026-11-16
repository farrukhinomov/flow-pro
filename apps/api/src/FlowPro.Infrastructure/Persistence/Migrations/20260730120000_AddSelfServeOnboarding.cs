using System;
using FlowPro.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlowPro.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
/// <remarks>
/// Hand-authored, so the <see cref="MigrationAttribute" /> that the tooling normally emits into a
/// companion Designer file is declared here instead. Regenerating this migration with
/// <c>dotnet ef migrations add AddSelfServeOnboarding</c> produces the same schema from
/// <c>TenantOnboardingConfiguration</c> and the updated <c>Tenant</c> aggregate.
/// </remarks>
[DbContext(typeof(FlowProDbContext))]
[Migration("20260730120000_AddSelfServeOnboarding")]
#pragma warning disable CA1861
public partial class AddSelfServeOnboarding : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.EnsureSchema(
            name: "onboarding");

        migrationBuilder.AddColumn<string>(
            name: "country_code",
            schema: "tenancy",
            table: "tenants",
            type: "character varying(2)",
            maxLength: 2,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "region_code",
            schema: "tenancy",
            table: "tenants",
            type: "character varying(10)",
            maxLength: 10,
            nullable: true);

        migrationBuilder.CreateTable(
                name: "tenant_onboardings",
                schema: "onboarding",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    started_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    company_resolved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    company_skipped = table.Column<bool>(type: "boolean", nullable: false),
                    team_resolved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    team_skipped = table.Column<bool>(type: "boolean", nullable: false),
                    absences_resolved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    absences_skipped = table.Column<bool>(type: "boolean", nullable: false),
                    first_clock_in_resolved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    first_clock_in_skipped = table.Column<bool>(type: "boolean", nullable: false),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenant_onboardings", x => x.id);
                    table.UniqueConstraint("AK_tenant_onboardings_tenant_id_id", x => new { x.tenant_id, x.id });
                    table.ForeignKey(
                        name: "FK_tenant_onboardings_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalSchema: "tenancy",
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_tenant_onboardings_users_tenant_id_started_by_user_id",
                        columns: x => new { x.tenant_id, x.started_by_user_id },
                        principalSchema: "identity",
                        principalTable: "users",
                        principalColumns: new[] { "tenant_id", "id" },
                        onDelete: ReferentialAction.Restrict);
                });

        migrationBuilder.CreateIndex(
                name: "IX_tenant_onboardings_tenant_id",
                schema: "onboarding",
                table: "tenant_onboardings",
                column: "tenant_id",
                unique: true);

        migrationBuilder.CreateIndex(
                name: "IX_tenant_onboardings_tenant_id_started_by_user_id",
                schema: "onboarding",
                table: "tenant_onboardings",
                columns: new[] { "tenant_id", "started_by_user_id" });

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

            ALTER TABLE onboarding.tenant_onboardings ENABLE ROW LEVEL SECURITY;

            DROP POLICY IF EXISTS tenant_isolation ON onboarding.tenant_onboardings;

            CREATE POLICY tenant_isolation ON onboarding.tenant_onboardings
            USING (tenant_id = infrastructure.current_tenant_id())
            WITH CHECK (tenant_id = infrastructure.current_tenant_id());
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DROP POLICY IF EXISTS tenant_isolation ON onboarding.tenant_onboardings;
            """);

        migrationBuilder.DropTable(
            name: "tenant_onboardings",
            schema: "onboarding");

        migrationBuilder.DropColumn(
            name: "country_code",
            schema: "tenancy",
            table: "tenants");

        migrationBuilder.DropColumn(
            name: "region_code",
            schema: "tenancy",
            table: "tenants");
    }
}
