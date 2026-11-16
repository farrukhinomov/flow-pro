using FlowPro.Application.Audit;
using FlowPro.Application.Common;
using FlowPro.Application.Identity;
using FlowPro.Application.Integration;
using FlowPro.Application.Organization;
using FlowPro.Domain.Audit;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Integration;
using FlowPro.Domain.Organization;

namespace FlowPro.Application.Tests.Organization;

public sealed class EmploymentContractWorkflowHandlerTests
{
    private static readonly Guid TenantId = Guid.Parse("01975fa8-7590-7000-8000-000000007001");
    private static readonly Guid ActorUserId = Guid.Parse("01975fa8-7590-7000-8000-000000007002");
    private static readonly DateTimeOffset Now = new(2026, 6, 14, 9, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task SaveContractCreatesContractAndServerEvents()
    {
        TestFixture fixture = new();
        fixture.AddEmployee("usr-marta");

        EmploymentContractDto result = await fixture.Handler.HandleAsync(
            new SaveEmploymentContractCommand(
                new EmploymentContractDto(
                    null,
                    "usr-marta",
                    new DateOnly(2026, 7, 1),
                    null,
                    40,
                    "Europe/Berlin",
                    Now,
                    Now)),
            CancellationToken.None);

        Assert.NotNull(result.Id);
        Assert.Equal("usr-marta", result.EmployeeId);
        Assert.Equal(40, result.WeeklyHours);
        Assert.Single(fixture.Repository.Contracts);
        Assert.Equal("employment_contract.saved.v1", Assert.Single(fixture.Outbox.Messages).EventType);
        Assert.Equal("employment_contract.saved.v1", Assert.Single(fixture.Audit.Events).Action);
    }

    [Fact]
    public async Task ListContractsFiltersByEmployeeExternalId()
    {
        TestFixture fixture = new();
        Employee first = fixture.AddEmployee("usr-first");
        Employee second = fixture.AddEmployee("usr-second");
        fixture.Repository.Contracts.Add(new EmploymentContract(
            TenantId,
            first.Id,
            new DateOnly(2026, 1, 1),
            2_400,
            "Europe/Berlin"));
        fixture.Repository.Contracts.Add(new EmploymentContract(
            TenantId,
            second.Id,
            new DateOnly(2026, 1, 1),
            1_800,
            "Europe/Berlin"));

        EmploymentContractPage result = await fixture.Handler.HandleAsync(
            new ListEmploymentContractsQuery("usr-second"),
            CancellationToken.None);

        EmploymentContractDto contract = Assert.Single(result.Items);
        Assert.Equal("usr-second", contract.EmployeeId);
        Assert.Equal(30, contract.WeeklyHours);
    }

    [Fact]
    public async Task SaveContractRequiresOrganizationManagePermission()
    {
        TestFixture fixture = new();
        fixture.AddEmployee("usr-denied");
        fixture.PermissionChecker.DeniedPermissions.Add(PermissionKeys.OrganizationManage);

        await Assert.ThrowsAsync<FlowProForbiddenException>(
            () => fixture.Handler.HandleAsync(
                new SaveEmploymentContractCommand(
                    new EmploymentContractDto(
                        null,
                        "usr-denied",
                        new DateOnly(2026, 7, 1),
                        null,
                        40,
                        "Europe/Berlin",
                        Now,
                        Now)),
                CancellationToken.None));

        Assert.Empty(fixture.Repository.Contracts);
        Assert.Empty(fixture.Outbox.Messages);
    }

    private sealed class TestFixture
    {
        public TestFixture()
        {
            Repository = new FakeEmploymentContractWorkflowRepository();
            Outbox = new FakeOutbox();
            Audit = new FakeAuditWriter();
            PermissionChecker = new FakePermissionChecker();
            Handler = new EmploymentContractWorkflowHandler(
                new FakeRequestContext(),
                PermissionChecker,
                Repository,
                Outbox,
                Audit,
                new FakeUnitOfWork(),
                new FixedTimeProvider());
        }

        public EmploymentContractWorkflowHandler Handler { get; }

        public FakeEmploymentContractWorkflowRepository Repository { get; }

        public FakeOutbox Outbox { get; }

        public FakeAuditWriter Audit { get; }

        public FakePermissionChecker PermissionChecker { get; }

        public Employee AddEmployee(string externalSubject)
        {
            Membership user = new(
                TenantId,
                externalSubject,
                $"{externalSubject}@example.com",
                externalSubject);
            Employee employee = new(
                TenantId,
                user.Id,
                externalSubject,
                externalSubject,
                "Person");
            Repository.Users.Add(user);
            Repository.Employees.Add(employee);
            return employee;
        }
    }

    private sealed class FakeRequestContext : ICurrentRequestContext
    {
        public RequestIdentity GetRequiredIdentity() => new(TenantId, ActorUserId);

        public RequestIdentity? TryGetIdentity() => GetRequiredIdentity();
    }

    private sealed class FakeUnitOfWork : IUnitOfWork
    {
        public Task<TResult> ExecuteAsync<TResult>(
            Func<CancellationToken, Task<TResult>> operation,
            CancellationToken cancellationToken) =>
            operation(cancellationToken);
    }

    private sealed class FixedTimeProvider : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private sealed class FakeEmploymentContractWorkflowRepository : IEmploymentContractWorkflowRepository
    {
        public List<EmploymentContract> Contracts { get; } = [];

        public List<Employee> Employees { get; } = [];

        public List<Membership> Users { get; } = [];

        public Task<IReadOnlyList<EmploymentContractProjection>> ListAsync(
            Guid tenantId,
            string? employeeExternalId,
            CancellationToken cancellationToken)
        {
            IEnumerable<EmploymentContractProjection> projections =
                from contract in Contracts
                join employee in Employees on contract.EmployeeId equals employee.Id
                join user in Users on employee.UserId equals user.Id
                where employeeExternalId is null || user.ExternalSubject == employeeExternalId
                select new EmploymentContractProjection(contract, employee, user);

            return Task.FromResult<IReadOnlyList<EmploymentContractProjection>>(projections.ToArray());
        }

        public Task<EmploymentContract?> FindContractAsync(
            Guid tenantId,
            Guid contractId,
            CancellationToken cancellationToken) =>
            Task.FromResult(Contracts.SingleOrDefault(contract => contract.Id == contractId));

        public Task<Employee?> FindEmployeeByExternalIdAsync(
            Guid tenantId,
            string employeeExternalId,
            CancellationToken cancellationToken)
        {
            Membership? user = Users.SingleOrDefault(item => item.ExternalSubject == employeeExternalId);
            return Task.FromResult(user is null
                ? null
                : Employees.SingleOrDefault(employee => employee.UserId == user.Id));
        }

        public void AddContract(EmploymentContract contract) => Contracts.Add(contract);
    }

    private sealed class FakeOutbox : IOutboxWriter
    {
        public List<OutboxMessage> Messages { get; } = [];

        public void Add(OutboxMessage message) => Messages.Add(message);
    }

    private sealed class FakeAuditWriter : IAuditWriter
    {
        public List<AuditEvent> Events { get; } = [];

        public void Add(AuditEvent auditEvent) => Events.Add(auditEvent);
    }

    private sealed class FakePermissionChecker : IPermissionChecker
    {
        public HashSet<string> DeniedPermissions { get; } = [];

        public Task<bool> HasPermissionAsync(
            Guid tenantId,
            Guid userId,
            string permission,
            CancellationToken cancellationToken) =>
            Task.FromResult(!DeniedPermissions.Contains(permission));
    }
}
