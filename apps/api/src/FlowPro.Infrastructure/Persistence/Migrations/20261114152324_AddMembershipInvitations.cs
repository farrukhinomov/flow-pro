using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlowPro.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
#pragma warning disable CA1861
public partial class AddMembershipInvitations : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "membership_invitations",
            schema: "identity",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                user_id = table.Column<Guid>(type: "uuid", nullable: false),
                email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                token_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                accepted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                revoked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_membership_invitations", x => x.id);
                table.ForeignKey(
                    name: "FK_membership_invitations_users_tenant_id_user_id",
                    columns: x => new { x.tenant_id, x.user_id },
                    principalSchema: "identity",
                    principalTable: "users",
                    principalColumns: new[] { "tenant_id", "id" },
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_membership_invitations_tenant_id_user_id",
            schema: "identity",
            table: "membership_invitations",
            columns: new[] { "tenant_id", "user_id" });

        migrationBuilder.CreateIndex(
            name: "IX_membership_invitations_token_hash",
            schema: "identity",
            table: "membership_invitations",
            column: "token_hash",
            unique: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "membership_invitations",
            schema: "identity");
    }
}
