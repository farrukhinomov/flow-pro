using System.Text.Json;
using FlowPro.Application.Demo;
using FlowPro.Application.Requests;
using FlowPro.Application.Sync;
using FlowPro.Domain.Attendance;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Integration;
using FlowPro.Domain.Organization;
using FlowPro.Domain.Sync;

namespace FlowPro.Application.Tests.Demo;

public sealed class DemoSampleDataTests
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    // A Saturday, so the working-day arithmetic has to skip a weekend in both directions.
    private static readonly DateTimeOffset Now = new(2026, 11, 14, 3, 0, 0, TimeSpan.Zero);

    private static readonly DateOnly Today = DateOnly.FromDateTime(Now.UtcDateTime);

    [Theory]
    [InlineData("2026-11-14", 1, "2026-11-16")]
    [InlineData("2026-11-14", -1, "2026-11-13")]
    [InlineData("2026-11-16", 5, "2026-11-23")]
    [InlineData("2026-11-16", -10, "2026-11-02")]
    [InlineData("2026-11-16", 0, "2026-11-16")]
    public void Working_days_skip_weekends(string from, int count, string expected)
    {
        Assert.Equal(DateOnly.Parse(expected, System.Globalization.CultureInfo.InvariantCulture),
            DemoSampleData.AddWorkingDays(DateOnly.Parse(from, System.Globalization.CultureInfo.InvariantCulture), count));
    }

    [Fact]
    public void Everyone_is_in_a_team_led_by_a_demo_login_and_has_a_contract()
    {
        List<DemoMember> members = Members();

        DemoSample sample = DemoSampleData.Build(DemoWorkspace.TenantId, members, Now);

        Assert.Equal(2, sample.Teams.Count);
        Team product = Assert.Single(sample.Teams, team => team.Code == "PRODUCT");
        Team customerSuccess = Assert.Single(sample.Teams, team => team.Code == "CS");
        Assert.Equal(Member(members, "DEMO-001").User.Id, product.ManagerUserId);
        Assert.Equal(Member(members, "DEMO-002").User.Id, customerSuccess.ManagerUserId);

        foreach (DemoMember member in members)
        {
            Guid expectedTeam = member.Team == DemoTeam.Product ? product.Id : customerSuccess.Id;
            Assert.Equal(expectedTeam, member.Employee.TeamId);
            EmploymentContract contract = Assert.Single(sample.Contracts, contract => contract.EmployeeId == member.Employee.Id);
            Assert.Equal(member.WeeklyMinutes, contract.WeeklyMinutes);
            Assert.True(contract.EffectiveFrom < Today);
        }
    }

    [Fact]
    public void Bookings_cover_the_last_two_working_weeks_except_approved_vacation()
    {
        List<DemoMember> members = Members();

        DemoSample sample = DemoSampleData.Build(DemoWorkspace.TenantId, members, Now);

        Assert.All(sample.Bookings, booking =>
        {
            DateOnly day = DateOnly.FromDateTime(booking.OccurredAt.UtcDateTime);
            Assert.True(day < Today);
            Assert.True(day >= DemoSampleData.AddWorkingDays(Today, -10));
            Assert.False(day.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday);
        });
        Assert.Equal(
            sample.Bookings.Count,
            sample.Bookings.Select(booking => booking.ClientOperationId).Distinct(StringComparer.Ordinal).Count());

        // Each day is a clock-in, a break and a clock-out, and every person ends the night clocked out.
        Assert.All(sample.AttendanceStates, state => Assert.Equal(WorkState.Finished, state.State));
        Assert.Equal(members.Count, sample.AttendanceStates.Count);

        EmployeeRequestDocument[] approvedVacations = Requests(sample)
            .Where(request => request.Status == "approved" && request.StatusTypeId == "vac")
            .ToArray();
        Assert.Contains(approvedVacations, request => request.FromDate < Today);

        foreach (EmployeeRequestDocument vacation in approvedVacations)
        {
            Guid employeeId = members.Single(member => member.User.Id == vacation.EmployeeId).Employee.Id;
            Assert.DoesNotContain(sample.Bookings, booking =>
                booking.EmployeeId == employeeId
                && DateOnly.FromDateTime(booking.OccurredAt.UtcDateTime) >= vacation.FromDate
                && DateOnly.FromDateTime(booking.OccurredAt.UtcDateTime) <= vacation.ToDate);
        }

        foreach (DemoMember member in members)
        {
            TimeBooking[] own = sample.Bookings.Where(booking => booking.EmployeeId == member.Employee.Id).ToArray();
            int days = own.Count(booking => booking.Type == TimeBookingType.ClockIn);
            Assert.Equal(days * 4, own.Length);
        }
    }

    [Fact]
    public void Requests_wait_for_the_manager_and_show_every_decision()
    {
        List<DemoMember> members = Members();

        DemoSample sample = DemoSampleData.Build(DemoWorkspace.TenantId, members, Now);
        EmployeeRequestDocument[] requests = Requests(sample);

        EmployeeRequestDocument jamie = Assert.Single(
            requests,
            request => request.EmployeeId == Member(members, "DEMO-003").User.Id);
        Assert.Equal("submitted", jamie.Status);
        Assert.True(jamie.FromDate > Today);

        Assert.Equal(2, requests.Count(request => request.Status == "submitted"));
        Assert.Equal(2, requests.Count(request => request.Status == "approved"));
        EmployeeRequestDocument rejected = Assert.Single(requests, request => request.Status == "rejected");
        Assert.Equal("reject", rejected.Decision?.Decision);
        Assert.False(string.IsNullOrWhiteSpace(rejected.Decision?.Comment));

        // An approved absence shows in the calendar as its own record, as the request workflow writes it.
        ClientAggregate[] absences = sample.Records.Where(record => record.AggregateType == "absence").ToArray();
        Assert.Equal(
            requests.Where(request => request.Status == "approved").Select(request => $"absence-{request.Id}").Order(),
            absences.Select(absence => absence.AggregateId).Order());

        Assert.All(sample.Records, record =>
            Assert.Contains(members, member => member.User.Id == record.OwnerUserId));
    }

    [Fact]
    public void Every_record_has_a_sync_event_so_browsers_receive_it()
    {
        DemoSample sample = DemoSampleData.Build(DemoWorkspace.TenantId, Members(), Now);

        Assert.Equal(sample.Records.Count, sample.SyncEvents.Count);

        foreach (ClientAggregate record in sample.Records)
        {
            Guid stableId = ClientAggregateIds.Stable(record.AggregateType, record.AggregateId);
            OutboxMessage syncEvent = Assert.Single(sample.SyncEvents, message => message.AggregateId == stableId);
            Assert.Equal("client-aggregate.upserted.v1", syncEvent.EventType);

            ClientAggregateSyncEvent payload = JsonSerializer.Deserialize<ClientAggregateSyncEvent>(syncEvent.PayloadJson, JsonOptions)!;
            Assert.Equal(record.AggregateType, payload.Aggregate);
            Assert.Equal(record.AggregateId, payload.AggregateId);
            Assert.Equal(record.OwnerUserId, payload.OwnerUserId);
            Assert.False(payload.Deleted);
        }
    }

    private static EmployeeRequestDocument[] Requests(DemoSample sample) =>
        sample.Records
            .Where(record => record.AggregateType == "request")
            .Select(record => JsonSerializer.Deserialize<EmployeeRequestDocument>(record.PayloadJson, JsonOptions)!)
            .ToArray();

    private static DemoMember Member(List<DemoMember> members, string personnelNumber) =>
        members.Single(member => member.Employee.PersonnelNumber == personnelNumber);

    private static List<DemoMember> Members()
    {
        Guid tenantId = DemoWorkspace.TenantId;
        List<DemoMember> members = [];

        foreach (DemoLogin login in DemoWorkspace.Logins)
        {
            members.Add(Create(login.Email, login.GivenName, login.FamilyName, login.PersonnelNumber, login.Team, DemoColleague.FullTimeWeeklyMinutes));
        }

        foreach (DemoColleague colleague in DemoWorkspace.Colleagues)
        {
            members.Add(Create(colleague.Email, colleague.GivenName, colleague.FamilyName, colleague.PersonnelNumber, colleague.Team, colleague.WeeklyMinutes));
        }

        return members;

        DemoMember Create(string email, string givenName, string familyName, string personnelNumber, DemoTeam team, int weeklyMinutes)
        {
            Membership user = new(tenantId, $"demo-{personnelNumber}", email, $"{givenName} {familyName}");
            return new DemoMember(user, new Employee(tenantId, user.Id, personnelNumber, givenName, familyName), team, weeklyMinutes);
        }
    }
}
