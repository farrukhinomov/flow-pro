using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlowPro.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
public partial class AddClientAggregateOwners : Migration
{
    private static readonly string[] OwnerIndexColumns =
    [
        "tenant_id",
        "owner_user_id",
        "updated_at",
    ];

    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(
            name: "owner_user_id",
            schema: "infrastructure",
            table: "client_aggregates",
            type: "uuid",
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_client_aggregates_tenant_id_owner_user_id_updated_at",
            schema: "infrastructure",
            table: "client_aggregates",
            columns: OwnerIndexColumns);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_client_aggregates_tenant_id_owner_user_id_updated_at",
            schema: "infrastructure",
            table: "client_aggregates");

        migrationBuilder.DropColumn(
            name: "owner_user_id",
            schema: "infrastructure",
            table: "client_aggregates");
    }
}
