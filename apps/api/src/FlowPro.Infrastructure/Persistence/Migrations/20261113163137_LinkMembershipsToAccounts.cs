using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlowPro.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
#pragma warning disable CA1861
public partial class LinkMembershipsToAccounts : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(
            name: "account_id",
            schema: "identity",
            table: "users",
            type: "uuid",
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_users_account_id_tenant_id",
            schema: "identity",
            table: "users",
            columns: new[] { "account_id", "tenant_id" },
            unique: true,
            filter: "account_id IS NOT NULL");

        migrationBuilder.AddForeignKey(
            name: "FK_users_accounts_account_id",
            schema: "identity",
            table: "users",
            column: "account_id",
            principalSchema: "identity",
            principalTable: "accounts",
            principalColumn: "id",
            onDelete: ReferentialAction.Restrict);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "FK_users_accounts_account_id",
            schema: "identity",
            table: "users");

        migrationBuilder.DropIndex(
            name: "IX_users_account_id_tenant_id",
            schema: "identity",
            table: "users");

        migrationBuilder.DropColumn(
            name: "account_id",
            schema: "identity",
            table: "users");
    }
}
