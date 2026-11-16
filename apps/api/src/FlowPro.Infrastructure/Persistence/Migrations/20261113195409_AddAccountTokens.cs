using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlowPro.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
#pragma warning disable CA1861
public partial class AddAccountTokens : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "account_tokens",
            schema: "identity",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                account_id = table.Column<Guid>(type: "uuid", nullable: false),
                purpose = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                token_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                consumed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_account_tokens", x => x.id);
                table.ForeignKey(
                    name: "FK_account_tokens_accounts_account_id",
                    column: x => x.account_id,
                    principalSchema: "identity",
                    principalTable: "accounts",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_account_tokens_account_id_purpose",
            schema: "identity",
            table: "account_tokens",
            columns: new[] { "account_id", "purpose" });

        migrationBuilder.CreateIndex(
            name: "IX_account_tokens_token_hash",
            schema: "identity",
            table: "account_tokens",
            column: "token_hash",
            unique: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "account_tokens",
            schema: "identity");
    }
}
