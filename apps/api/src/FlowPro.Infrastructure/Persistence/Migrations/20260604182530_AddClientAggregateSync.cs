using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlowPro.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
public partial class AddClientAggregateSync : Migration
{
    private static readonly string[] ClientAggregateSyncIndexColumns =
    [
        "tenant_id",
        "aggregate_type",
        "is_deleted",
    ];

    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "client_aggregates",
            schema: "infrastructure",
            columns: table => new
            {
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                aggregate_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                aggregate_id = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                payload_json = table.Column<string>(type: "jsonb", nullable: false),
                last_client_operation_id = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                client_updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                is_deleted = table.Column<bool>(type: "boolean", nullable: false),
                deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                version = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_client_aggregates", x => new { x.tenant_id, x.aggregate_type, x.aggregate_id });
                table.ForeignKey(
                    name: "FK_client_aggregates_tenants_tenant_id",
                    column: x => x.tenant_id,
                    principalSchema: "tenancy",
                    principalTable: "tenants",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_client_aggregates_tenant_id_aggregate_type_is_deleted",
            schema: "infrastructure",
            table: "client_aggregates",
            columns: ClientAggregateSyncIndexColumns);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "client_aggregates",
            schema: "infrastructure");
    }
}
