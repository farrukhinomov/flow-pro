using FlowPro.Domain.Common;

namespace FlowPro.Domain.Identity;

/// <summary>
/// One person's place in one workspace: their name, address, status and roles there. A person
/// signs in with an <see cref="Account" />, which can hold memberships in several workspaces.
/// </summary>
/// <remarks>
/// Stored in <c>identity.users</c>, and other tables refer to it as <c>user_id</c>; the names
/// predate the split between accounts and memberships.
/// </remarks>
public sealed class Membership : ITrackedEntity
{
    private Membership()
    {
    }

    public Membership(
        Guid tenantId,
        string externalSubject,
        string email,
        string displayName,
        Guid? id = null)
    {
        Id = id ?? Guid.CreateVersion7();
        TenantId = tenantId;
        ExternalSubject = Guard.Required(externalSubject, nameof(externalSubject), 200);
        Email = Guard.Required(email, nameof(email), 320).ToLowerInvariant();
        DisplayName = Guard.Required(displayName, nameof(displayName), 200);
        Status = UserStatus.Active;
        Version = 1;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string ExternalSubject { get; private set; } = string.Empty;

    /// <summary>
    /// The <see cref="Account" /> that signs in as this member, or null while nobody has claimed
    /// the membership yet (an invitation that has not been accepted).
    /// </summary>
    public Guid? AccountId { get; private set; }

    public string Email { get; private set; } = string.Empty;

    public string DisplayName { get; private set; } = string.Empty;

    public UserStatus Status { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public long Version { get; private set; }

    public void UpdateProfile(string externalSubject, string email, string displayName)
    {
        ExternalSubject = Guard.Required(externalSubject, nameof(externalSubject), 200);
        Email = Guard.Required(email, nameof(email), 320).ToLowerInvariant();
        DisplayName = Guard.Required(displayName, nameof(displayName), 200);
        Version++;
    }

    public void LinkAccount(Guid accountId)
    {
        if (accountId == Guid.Empty)
        {
            throw new ArgumentException("An account identifier is required.", nameof(accountId));
        }

        if (AccountId == accountId)
        {
            return;
        }

        if (AccountId is not null)
        {
            throw new InvalidOperationException("This membership already belongs to another account.");
        }

        AccountId = accountId;
        Version++;
    }

    /// <summary>
    /// Whether the person behind an invitation can still take this membership up: nobody has
    /// signed in to it yet and an administrator has not closed it.
    /// </summary>
    public bool IsOpenForInvitation =>
        AccountId is null && Status is UserStatus.Invited or UserStatus.Active;

    /// <summary>Gives the membership to the account that accepted the invitation.</summary>
    public void AcceptInvitation(Guid accountId, string email, string displayName)
    {
        if (!IsOpenForInvitation)
        {
            throw new InvalidOperationException("This membership can no longer be taken up.");
        }

        LinkAccount(accountId);
        Email = Guard.Required(email, nameof(email), 320).ToLowerInvariant();
        DisplayName = Guard.Required(displayName, nameof(displayName), 200);
        Status = UserStatus.Active;
        Version++;
    }

    public void MarkInvited()
    {
        Status = UserStatus.Invited;
        Version++;
    }

    public void Deactivate()
    {
        Status = UserStatus.Inactive;
        Version++;
    }

    public void Reactivate()
    {
        Status = UserStatus.Active;
        Version++;
    }
}
