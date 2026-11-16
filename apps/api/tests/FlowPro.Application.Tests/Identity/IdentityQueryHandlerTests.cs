using FlowPro.Application.Common;
using FlowPro.Application.Identity;

namespace FlowPro.Application.Tests.Identity;

public sealed class IdentityQueryHandlerTests
{
    private static readonly Guid TenantId = Guid.Parse("01975fa8-7590-7000-8000-000000002001");
    private static readonly Guid UserId = Guid.Parse("01975fa8-7590-7000-8000-000000002002");

    [Fact]
    public async Task Current_session_returns_tenant_user_roles_and_permissions()
    {
        CurrentSession expected = new(
            TenantId,
            "acme",
            "Acme GmbH",
            UserId,
            "external-subject",
            "person@example.com",
            "Example Person",
            ["employee"],
            ["sync.read.self"],
            ["Support"]);
        IdentityQueryHandler handler = new(
            new FakeCurrentRequestContext(TenantId, UserId),
            new FakeIdentitySessionRepository(expected));

        CurrentSession session = await handler.HandleAsync(
            new GetCurrentSessionQuery(),
            CancellationToken.None);

        Assert.Equal(expected, session);
    }

    [Fact]
    public async Task Current_session_rejects_unresolvable_identity()
    {
        IdentityQueryHandler handler = new(
            new FakeCurrentRequestContext(TenantId, UserId),
            new FakeIdentitySessionRepository(null));

        await Assert.ThrowsAsync<FlowProUnauthorizedException>(
            () => handler.HandleAsync(new GetCurrentSessionQuery(), CancellationToken.None));
    }

    private sealed class FakeCurrentRequestContext(Guid tenantId, Guid userId)
        : ICurrentRequestContext
    {
        public RequestIdentity GetRequiredIdentity() => new(tenantId, userId);

        public RequestIdentity? TryGetIdentity() => GetRequiredIdentity();
    }

    private sealed class FakeIdentitySessionRepository(CurrentSession? session)
        : IIdentitySessionRepository
    {
        public Task<CurrentSession?> GetCurrentSessionAsync(
            Guid tenantId,
            Guid userId,
            CancellationToken cancellationToken) =>
            Task.FromResult(session);
    }
}
