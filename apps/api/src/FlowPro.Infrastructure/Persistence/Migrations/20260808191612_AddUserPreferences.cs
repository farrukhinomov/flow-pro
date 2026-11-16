using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlowPro.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
#pragma warning disable CA1861
public partial class AddUserPreferences : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "user_preferences",
            schema: "identity",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                owner_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                locale = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                time_zone_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                week_start = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                default_work_location = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                density_compact = table.Column<bool>(type: "boolean", nullable: false),
                show_sync_status = table.Column<bool>(type: "boolean", nullable: false),
                show_policy_hints = table.Column<bool>(type: "boolean", nullable: false),
                full_width_pages = table.Column<bool>(type: "boolean", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                version = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_user_preferences", x => x.id);
                table.UniqueConstraint("AK_user_preferences_tenant_id_id", x => new { x.tenant_id, x.id });
                table.ForeignKey(
                    name: "FK_user_preferences_tenants_tenant_id",
                    column: x => x.tenant_id,
                    principalSchema: "tenancy",
                    principalTable: "tenants",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "FK_user_preferences_users_tenant_id_owner_user_id",
                    columns: x => new { x.tenant_id, x.owner_user_id },
                    principalSchema: "identity",
                    principalTable: "users",
                    principalColumns: new[] { "tenant_id", "id" },
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_user_preferences_tenant_id_owner_user_id",
            schema: "identity",
            table: "user_preferences",
            columns: new[] { "tenant_id", "owner_user_id" },
            unique: true);

        // Row Level Security is not scaffolded by EF, so every migration that
        // adds a tenant-owned table has to enable it explicitly. Without this
        // the table would be the only tenant table missing the database-level
        // isolation that backs up application scoping.
        migrationBuilder.Sql(
            """
            ALTER TABLE identity.user_preferences ENABLE ROW LEVEL SECURITY;

            CREATE POLICY tenant_isolation ON identity.user_preferences
            USING (tenant_id = infrastructure.current_tenant_id())
            WITH CHECK (tenant_id = infrastructure.current_tenant_id());
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            "DROP POLICY IF EXISTS tenant_isolation ON identity.user_preferences;");

        migrationBuilder.DropTable(
            name: "user_preferences",
            schema: "identity");
    }
}
