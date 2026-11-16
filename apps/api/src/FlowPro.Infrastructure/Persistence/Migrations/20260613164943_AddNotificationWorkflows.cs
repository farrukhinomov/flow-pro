using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlowPro.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
#pragma warning disable CA1861
public partial class AddNotificationWorkflows : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.EnsureSchema(
            name: "notifications");

        migrationBuilder.CreateTable(
                name: "notification_preferences",
                schema: "notifications",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    approval_queue = table.Column<bool>(type: "boolean", nullable: false),
                    request_decisions = table.Column<bool>(type: "boolean", nullable: false),
                    security_emails = table.Column<bool>(type: "boolean", nullable: false),
                    sync_failures = table.Column<bool>(type: "boolean", nullable: false),
                    timesheet_exceptions = table.Column<bool>(type: "boolean", nullable: false),
                    weekly_summary = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notification_preferences", x => x.id);
                    table.UniqueConstraint("AK_notification_preferences_tenant_id_id", x => new { x.tenant_id, x.id });
                    table.ForeignKey(
                        name: "FK_notification_preferences_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalSchema: "tenancy",
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_notification_preferences_users_tenant_id_owner_user_id",
                        columns: x => new { x.tenant_id, x.owner_user_id },
                        principalSchema: "identity",
                        principalTable: "users",
                        principalColumns: new[] { "tenant_id", "id" },
                        onDelete: ReferentialAction.Restrict);
                });

        migrationBuilder.CreateTable(
                name: "notifications",
                schema: "notifications",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    external_id = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    recipient_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    source_id = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    read_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notifications", x => x.id);
                    table.UniqueConstraint("AK_notifications_tenant_id_id", x => new { x.tenant_id, x.id });
                    table.ForeignKey(
                        name: "FK_notifications_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalSchema: "tenancy",
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_notifications_users_tenant_id_recipient_user_id",
                        columns: x => new { x.tenant_id, x.recipient_user_id },
                        principalSchema: "identity",
                        principalTable: "users",
                        principalColumns: new[] { "tenant_id", "id" },
                        onDelete: ReferentialAction.Restrict);
                });

        migrationBuilder.CreateIndex(
                name: "IX_notification_preferences_tenant_id_owner_user_id",
                schema: "notifications",
                table: "notification_preferences",
                columns: new[] { "tenant_id", "owner_user_id" },
                unique: true);

        migrationBuilder.CreateIndex(
                name: "IX_notifications_tenant_id_external_id",
                schema: "notifications",
                table: "notifications",
                columns: new[] { "tenant_id", "external_id" },
                unique: true);

        migrationBuilder.CreateIndex(
                name: "IX_notifications_tenant_id_recipient_user_id_created_at_utc",
                schema: "notifications",
                table: "notifications",
            columns: new[] { "tenant_id", "recipient_user_id", "created_at_utc" });

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

            ALTER TABLE notifications.notification_preferences ENABLE ROW LEVEL SECURITY;
            ALTER TABLE notifications.notifications ENABLE ROW LEVEL SECURITY;

            CREATE POLICY tenant_isolation ON notifications.notification_preferences
            USING (tenant_id = infrastructure.current_tenant_id())
            WITH CHECK (tenant_id = infrastructure.current_tenant_id());

            CREATE POLICY tenant_isolation ON notifications.notifications
            USING (tenant_id = infrastructure.current_tenant_id())
            WITH CHECK (tenant_id = infrastructure.current_tenant_id());
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DROP POLICY IF EXISTS tenant_isolation ON notifications.notification_preferences;
            DROP POLICY IF EXISTS tenant_isolation ON notifications.notifications;
            """);

        migrationBuilder.DropTable(
            name: "notification_preferences",
            schema: "notifications");

        migrationBuilder.DropTable(
            name: "notifications",
            schema: "notifications");
    }
}
