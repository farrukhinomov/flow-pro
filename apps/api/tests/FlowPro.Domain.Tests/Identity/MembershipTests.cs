using FlowPro.Domain.Identity;

namespace FlowPro.Domain.Tests.Identity;

public sealed class MembershipTests
{
    [Fact]
    public void A_new_membership_has_no_account()
    {
        Membership user = NewUser();

        Assert.Null(user.AccountId);
    }

    [Fact]
    public void Linking_an_account_is_recorded_once()
    {
        Membership user = NewUser();
        Guid accountId = Guid.CreateVersion7();
        long initial = user.Version;

        user.LinkAccount(accountId);
        user.LinkAccount(accountId);

        Assert.Equal(accountId, user.AccountId);
        Assert.Equal(initial + 1, user.Version);
    }

    [Fact]
    public void A_membership_cannot_move_to_another_account()
    {
        Membership user = NewUser();
        user.LinkAccount(Guid.CreateVersion7());

        Assert.Throws<InvalidOperationException>(() => user.LinkAccount(Guid.CreateVersion7()));
    }

    [Fact]
    public void An_empty_account_identifier_is_rejected()
    {
        Assert.Throws<ArgumentException>(() => NewUser().LinkAccount(Guid.Empty));
    }

    private static Membership NewUser() =>
        new(Guid.CreateVersion7(), "subject", "ada@example.com", "Ada");
}
