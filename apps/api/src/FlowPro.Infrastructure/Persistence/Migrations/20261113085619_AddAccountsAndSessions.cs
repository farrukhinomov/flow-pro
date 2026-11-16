using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlowPro.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
#pragma warning disable CA1861
public partial class AddAccountsAndSessions : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "account_security_events",
            schema: "identity",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                type = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                account_id = table.Column<Guid>(type: "uuid", nullable: true),
                email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                ip_address = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                user_agent = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                occurred_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_account_security_events", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "accounts",
            schema: "identity",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                display_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                password_hash = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                security_stamp = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                email_confirmed = table.Column<bool>(type: "boolean", nullable: false),
                access_failed_count = table.Column<int>(type: "integer", nullable: false),
                lockout_end = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                version = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_accounts", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "account_sessions",
            schema: "identity",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                account_id = table.Column<Guid>(type: "uuid", nullable: false),
                token_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                last_seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                revoked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                user_agent = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                ip_address = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                active_tenant_id = table.Column<Guid>(type: "uuid", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_account_sessions", x => x.id);
                table.ForeignKey(
                    name: "FK_account_sessions_accounts_account_id",
                    column: x => x.account_id,
                    principalSchema: "identity",
                    principalTable: "accounts",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_account_security_events_account_id_occurred_at",
            schema: "identity",
            table: "account_security_events",
            columns: new[] { "account_id", "occurred_at" });

        migrationBuilder.CreateIndex(
            name: "IX_account_sessions_account_id",
            schema: "identity",
            table: "account_sessions",
            column: "account_id");

        migrationBuilder.CreateIndex(
            name: "IX_account_sessions_token_hash",
            schema: "identity",
            table: "account_sessions",
            column: "token_hash",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_accounts_email",
            schema: "identity",
            table: "accounts",
            column: "email",
            unique: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "account_security_events",
            schema: "identity");

        migrationBuilder.DropTable(
            name: "account_sessions",
            schema: "identity");

        migrationBuilder.DropTable(
            name: "accounts",
            schema: "identity");
    }
}
