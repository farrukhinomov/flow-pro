using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlowPro.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
#pragma warning disable CA1861
public partial class AddTwoFactorSignIn : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "authenticator_key",
            schema: "identity",
            table: "accounts",
            type: "character varying(1000)",
            maxLength: 1000,
            nullable: true);

        migrationBuilder.AddColumn<long>(
            name: "authenticator_time_step",
            schema: "identity",
            table: "accounts",
            type: "bigint",
            nullable: true);

        migrationBuilder.AddColumn<bool>(
            name: "two_factor_enabled",
            schema: "identity",
            table: "accounts",
            type: "boolean",
            nullable: false,
            defaultValue: false);

        migrationBuilder.CreateTable(
            name: "account_recovery_codes",
            schema: "identity",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                account_id = table.Column<Guid>(type: "uuid", nullable: false),
                code_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                used_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_account_recovery_codes", x => x.id);
                table.ForeignKey(
                    name: "FK_account_recovery_codes_accounts_account_id",
                    column: x => x.account_id,
                    principalSchema: "identity",
                    principalTable: "accounts",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_account_recovery_codes_account_id",
            schema: "identity",
            table: "account_recovery_codes",
            column: "account_id");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "account_recovery_codes",
            schema: "identity");

        migrationBuilder.DropColumn(
            name: "authenticator_key",
            schema: "identity",
            table: "accounts");

        migrationBuilder.DropColumn(
            name: "authenticator_time_step",
            schema: "identity",
            table: "accounts");

        migrationBuilder.DropColumn(
            name: "two_factor_enabled",
            schema: "identity",
            table: "accounts");
    }
}
