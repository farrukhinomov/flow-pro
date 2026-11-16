using FlowPro.Domain.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlowPro.Infrastructure.Persistence.Configurations;

// Accounts, their sessions and their security events are not tenant-owned: a person signs in
// before any tenant is known. These tables therefore carry no tenant_id and no row level security
// policy; access is limited to the account and session handlers.

internal sealed class AccountConfiguration : IEntityTypeConfiguration<Account>
{
    public void Configure(EntityTypeBuilder<Account> builder)
    {
        builder.ToTable("accounts", DatabaseSchemas.Identity);
        builder.HasKey(account => account.Id);
        builder.Property(account => account.Email).HasMaxLength(320).IsRequired();
        builder.Property(account => account.DisplayName).HasMaxLength(200).IsRequired();
        builder.Property(account => account.PasswordHash).HasMaxLength(500);
        builder.Property(account => account.SecurityStamp).HasMaxLength(100).IsRequired();
        builder.Property(account => account.AuthenticatorKey).HasMaxLength(1000);
        builder.HasIndex(account => account.Email).IsUnique();
        builder.ConfigureTrackedEntity();
    }
}

internal sealed class AccountSessionConfiguration : IEntityTypeConfiguration<AccountSession>
{
    public void Configure(EntityTypeBuilder<AccountSession> builder)
    {
        builder.ToTable("account_sessions", DatabaseSchemas.Identity);
        builder.HasKey(session => session.Id);
        builder.Property(session => session.TokenHash).HasMaxLength(64).IsRequired();
        builder.Property(session => session.UserAgent).HasMaxLength(400);
        builder.Property(session => session.IpAddress).HasMaxLength(64);
        builder.HasIndex(session => session.TokenHash).IsUnique();
        builder.HasIndex(session => session.AccountId);
        builder.HasOne<Account>()
            .WithMany()
            .HasForeignKey(session => session.AccountId);
    }
}

internal sealed class AccountTokenConfiguration : IEntityTypeConfiguration<AccountToken>
{
    public void Configure(EntityTypeBuilder<AccountToken> builder)
    {
        builder.ToTable("account_tokens", DatabaseSchemas.Identity);
        builder.HasKey(token => token.Id);
        builder.Property(token => token.Purpose).HasMaxLength(40).IsRequired();
        builder.Property(token => token.TokenHash).HasMaxLength(64).IsRequired();
        builder.Property(token => token.NewEmail).HasMaxLength(320);
        builder.HasIndex(token => token.TokenHash).IsUnique();
        builder.HasIndex(token => new { token.AccountId, token.Purpose });
        builder.HasOne<Account>()
            .WithMany()
            .HasForeignKey(token => token.AccountId);
    }
}

internal sealed class AccountRecoveryCodeConfiguration : IEntityTypeConfiguration<AccountRecoveryCode>
{
    public void Configure(EntityTypeBuilder<AccountRecoveryCode> builder)
    {
        builder.ToTable("account_recovery_codes", DatabaseSchemas.Identity);
        builder.HasKey(code => code.Id);
        builder.Property(code => code.CodeHash).HasMaxLength(64).IsRequired();
        builder.Ignore(code => code.IsUsed);
        builder.HasIndex(code => code.AccountId);
        builder.HasOne<Account>()
            .WithMany()
            .HasForeignKey(code => code.AccountId);
    }
}

internal sealed class AccountSecurityEventConfiguration : IEntityTypeConfiguration<AccountSecurityEvent>
{
    public void Configure(EntityTypeBuilder<AccountSecurityEvent> builder)
    {
        builder.ToTable("account_security_events", DatabaseSchemas.Identity);
        builder.HasKey(securityEvent => securityEvent.Id);
        builder.Property(securityEvent => securityEvent.Type).HasMaxLength(60).IsRequired();
        builder.Property(securityEvent => securityEvent.Email).HasMaxLength(320);
        builder.Property(securityEvent => securityEvent.IpAddress).HasMaxLength(64);
        builder.Property(securityEvent => securityEvent.UserAgent).HasMaxLength(400);
        builder.HasIndex(securityEvent => new { securityEvent.AccountId, securityEvent.OccurredAt });

        // No foreign key to accounts: a failed attempt may name an email that has no account, and
        // the history must survive if an account is ever removed.
    }
}

internal sealed class MembershipInvitationConfiguration : IEntityTypeConfiguration<MembershipInvitation>
{
    public void Configure(EntityTypeBuilder<MembershipInvitation> builder)
    {
        // Not under row-level security: the link is followed before anyone acts in the workspace,
        // and only its hash is stored. Accepting then runs in the invitation's workspace.
        builder.ToTable("membership_invitations", DatabaseSchemas.Identity);
        builder.HasKey(invitation => invitation.Id);
        builder.Property(invitation => invitation.Email).HasMaxLength(320).IsRequired();
        builder.Property(invitation => invitation.TokenHash).HasMaxLength(64).IsRequired();
        builder.HasIndex(invitation => invitation.TokenHash).IsUnique();
        builder.HasIndex(invitation => new { invitation.TenantId, invitation.UserId });
        builder.HasOne<Membership>()
            .WithMany()
            .HasForeignKey(invitation => new { invitation.TenantId, invitation.UserId })
            .HasPrincipalKey(user => new { user.TenantId, user.Id });
    }
}
