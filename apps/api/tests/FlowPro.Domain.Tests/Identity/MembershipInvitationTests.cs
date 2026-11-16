using FlowPro.Domain.Identity;

namespace FlowPro.Domain.Tests.Identity;

public sealed class MembershipInvitationTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 14, 9, 0, 0, TimeSpan.Zero);

    [Fact]
    public void An_invitation_is_usable_once_until_it_expires()
    {
        MembershipInvitation invitation = Create();

        Assert.True(invitation.IsUsable(Now));
        Assert.False(invitation.IsUsable(Now.AddDays(7)));

        invitation.Accept(Now);

        Assert.False(invitation.IsUsable(Now));
        Assert.Throws<InvalidOperationException>(() => invitation.Accept(Now));
    }

    [Fact]
    public void A_revoked_invitation_cannot_be_accepted_and_an_accepted_one_stays_accepted()
    {
        MembershipInvitation revoked = Create();
        revoked.Revoke(Now);
        Assert.Throws<InvalidOperationException>(() => revoked.Accept(Now));

        MembershipInvitation accepted = Create();
        accepted.Accept(Now);
        accepted.Revoke(Now.AddMinutes(1));
        Assert.Null(accepted.RevokedAt);
    }

    [Fact]
    public void The_address_is_stored_normalized()
    {
        Assert.Equal("grace@example.com", Create(" Grace@Example.com ").Email);
    }

    [Fact]
    public void Accepting_links_the_membership_and_activates_it()
    {
        Membership membership = new(Guid.CreateVersion7(), "usr-grace", "grace@example.com", "Invited");
        membership.MarkInvited();
        Guid accountId = Guid.CreateVersion7();

        membership.AcceptInvitation(accountId, "Grace@Example.com", "Grace Hopper");

        Assert.Equal(accountId, membership.AccountId);
        Assert.Equal(UserStatus.Active, membership.Status);
        Assert.Equal("grace@example.com", membership.Email);
        Assert.Equal("Grace Hopper", membership.DisplayName);
        Assert.False(membership.IsOpenForInvitation);
    }

    [Fact]
    public void A_closed_or_taken_membership_is_not_open_for_invitation()
    {
        Membership closed = new(Guid.CreateVersion7(), "usr-a", "a@example.com", "A");
        closed.Deactivate();
        Membership taken = new(Guid.CreateVersion7(), "usr-b", "b@example.com", "B");
        taken.LinkAccount(Guid.CreateVersion7());

        Assert.False(closed.IsOpenForInvitation);
        Assert.False(taken.IsOpenForInvitation);
        Assert.Throws<InvalidOperationException>(
            () => closed.AcceptInvitation(Guid.CreateVersion7(), "a@example.com", "A"));
    }

    private static MembershipInvitation Create(string email = "grace@example.com") =>
        new(Guid.CreateVersion7(), Guid.CreateVersion7(), email, new string('a', 64), Now, TimeSpan.FromDays(7));
}
