using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlowPro.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
#pragma warning disable CA1861
public partial class AddAttendancePolicyEffectiveFrom : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Added nullable so existing rows can be backfilled from their own
        // publish date before the column is tightened. The scaffolded default
        // was year 1, which would have claimed every historic policy had
        // applied since the beginning of time.
        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "effective_from",
            schema: "policies",
            table: "attendance_policy_versions",
            type: "timestamp with time zone",
            nullable: true);

        // Before effective dates existed a policy took effect when it was
        // published, so that is the honest value for rows written until now.
        migrationBuilder.Sql(
            """
            UPDATE policies.attendance_policy_versions
            SET effective_from = published_at
            WHERE effective_from IS NULL;
            """);

        migrationBuilder.AlterColumn<DateTimeOffset>(
            name: "effective_from",
            schema: "policies",
            table: "attendance_policy_versions",
            type: "timestamp with time zone",
            nullable: false,
            oldClrType: typeof(DateTimeOffset),
            oldType: "timestamp with time zone",
            oldNullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_attendance_policy_versions_tenant_id_policy_id_effective_fr~",
            schema: "policies",
            table: "attendance_policy_versions",
            columns: new[] { "tenant_id", "policy_id", "effective_from" });
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_attendance_policy_versions_tenant_id_policy_id_effective_fr~",
            schema: "policies",
            table: "attendance_policy_versions");

        migrationBuilder.DropColumn(
            name: "effective_from",
            schema: "policies",
            table: "attendance_policy_versions");
    }
}
