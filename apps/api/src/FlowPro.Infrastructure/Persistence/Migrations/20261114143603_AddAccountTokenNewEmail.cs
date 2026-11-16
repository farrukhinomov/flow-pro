using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlowPro.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
public partial class AddAccountTokenNewEmail : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "new_email",
            schema: "identity",
            table: "account_tokens",
            type: "character varying(320)",
            maxLength: 320,
            nullable: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "new_email",
            schema: "identity",
            table: "account_tokens");
    }
}
