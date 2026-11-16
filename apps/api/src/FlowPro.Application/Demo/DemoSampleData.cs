using System.Text.Json;
using FlowPro.Application.Requests;
using FlowPro.Application.Sync;
using FlowPro.Domain.Attendance;
using FlowPro.Domain.Identity;
using FlowPro.Domain.Integration;
using FlowPro.Domain.Organization;
using FlowPro.Domain.Sync;

namespace FlowPro.Application.Demo;

/// <summary>A person in the demo workspace, with or without a login.</summary>
public sealed record DemoMember(Membership User, Employee Employee, DemoTeam Team, int WeeklyMinutes);

/// <summary>Everything the demo seeds beyond its people and the defaults every workspace gets.</summary>
public sealed record DemoSample(
    IReadOnlyList<Team> Teams,
    IReadOnlyList<EmploymentContract> Contracts,
    IReadOnlyList<TimeBooking> Bookings,
    IReadOnlyList<AttendanceState> AttendanceStates,
    IReadOnlyList<ClientAggregate> Records,
    IReadOnlyList<OutboxMessage> SyncEvents);

/// <summary>Writes a <see cref="DemoSample" /> in the caller's transaction.</summary>
public interface IDemoSampleWriter
{
    void Add(DemoSample sample);
}

/// <summary>
/// Builds the demo's sample data: two teams, a contract each, the last two weeks of time bookings,
/// and requests in every state a visitor might want to see.
/// </summary>
/// <remarks>
/// Dates are relative to the reset, so the demo looks lived in on any day. Requests are stored the
/// way the request workflow stores them, as client records with a sync event each, so browsers pick
/// them up through the ordinary sync feed.
/// </remarks>
public static class DemoSampleData
{
    public const string SyncClientId = "flowpro-demo-seed";

    private const int BookedDays = 10;
    private const int BreakMinutes = 30;
    private const string TimeZoneId = "Europe/Berlin";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static DemoSample Build(Guid tenantId, IReadOnlyList<DemoMember> members, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(members);

        DateOnly today = DateOnly.FromDateTime(now.UtcDateTime);
        DemoMember lead = Find(members, DemoWorkspace.Logins[0].PersonnelNumber);
        DemoMember manager = Find(members, DemoWorkspace.Logins[1].PersonnelNumber);

        Team product = new(tenantId, null, "PRODUCT", "Product", externalId: "team-product", managerUserId: lead.User.Id);
        Team customerSuccess = new(tenantId, null, "CS", "Customer Success", externalId: "team-customer-success", managerUserId: manager.User.Id);

        foreach (DemoMember member in members)
        {
            Employee employee = member.Employee;
            employee.UpdateProfile(
                employee.PersonnelNumber,
                employee.GivenName,
                employee.FamilyName,
                member.Team == DemoTeam.Product ? product.Id : customerSuccess.Id,
                departmentId: null,
                primaryLocationId: null,
                isActive: true);
        }

        DateOnly contractStart = new(today.Year - 1, 1, 1);
        EmploymentContract[] contracts = members
            .Select(member => new EmploymentContract(
                tenantId,
                member.Employee.Id,
                contractStart,
                member.WeeklyMinutes,
                TimeZoneId))
            .ToArray();

        List<DemoRequest> requests = BuildRequests(members, lead, manager, today, now);
        (List<TimeBooking> bookings, List<AttendanceState> states) =
            BuildBookings(tenantId, members, requests, today);
        (List<ClientAggregate> records, List<OutboxMessage> events) = BuildRecords(tenantId, requests, now);

        return new DemoSample([product, customerSuccess], contracts, bookings, states, records, events);
    }

    /// <summary>Weekdays only: <paramref name="count" /> working days after (or, if negative, before) <paramref name="from" />.</summary>
    public static DateOnly AddWorkingDays(DateOnly from, int count)
    {
        int step = Math.Sign(count);
        DateOnly day = from;

        for (int remaining = Math.Abs(count); remaining > 0;)
        {
            day = day.AddDays(step);
            if (IsWorkingDay(day))
            {
                remaining--;
            }
        }

        return day;
    }

    private static bool IsWorkingDay(DateOnly day) =>
        day.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday);

    private static DemoMember Find(IReadOnlyList<DemoMember> members, string personnelNumber) =>
        members.Single(member => member.Employee.PersonnelNumber == personnelNumber);

    private static List<DemoRequest> BuildRequests(
        IReadOnlyList<DemoMember> members,
        DemoMember lead,
        DemoMember manager,
        DateOnly today,
        DateTimeOffset now)
    {
        DemoMember Member(string personnelNumber) => Find(members, personnelNumber);

        DateOnly ownVacation = AddWorkingDays(today, 15);
        DateOnly approvedVacation = AddWorkingDays(today, 6);
        DateOnly pastVacation = AddWorkingDays(today, -4);

        return
        [
            // Waiting for the manager, so a visitor signed in as the manager has something to approve.
            new(Member("DEMO-003"), DemoAbsence.Vacation, ownVacation, AddWorkingDays(ownVacation, 4),
                "Family trip.", now.AddDays(-1), Decision: null),
            new(Member("DEMO-005"), DemoAbsence.HomeOffice, AddWorkingDays(today, 2), AddWorkingDays(today, 2),
                "Waiting for a furniture delivery.", now.AddHours(-20), Decision: null),
            new(Member("DEMO-004"), DemoAbsence.Vacation, approvedVacation, AddWorkingDays(approvedVacation, 4),
                "Summer holiday.", now.AddDays(-6),
                new DemoDecision("approve", manager, now.AddDays(-5), "Enjoy the break.")),
            new(Member("DEMO-008"), DemoAbsence.Vacation, pastVacation, AddWorkingDays(pastVacation, 1),
                "Moving house.", now.AddDays(-12),
                new DemoDecision("approve", lead, now.AddDays(-11), Comment: null)),
            new(Member("DEMO-007"), DemoAbsence.HomeOffice, AddWorkingDays(today, 1), AddWorkingDays(today, 1),
                "Quiet day for the roadmap draft.", now.AddDays(-2),
                new DemoDecision("reject", lead, now.AddDays(-1), "The product review is on site that day.")),
        ];
    }

    private static (List<TimeBooking> Bookings, List<AttendanceState> States) BuildBookings(
        Guid tenantId,
        IReadOnlyList<DemoMember> members,
        IReadOnlyList<DemoRequest> requests,
        DateOnly today)
    {
        List<TimeBooking> bookings = [];
        List<AttendanceState> states = [];

        for (int person = 0; person < members.Count; person++)
        {
            DemoMember member = members[person];
            AttendanceState state = AttendanceState.Create(tenantId, member.Employee.Id);
            int dailyMinutes = member.WeeklyMinutes / 5;

            for (int dayIndex = BookedDays; dayIndex >= 1; dayIndex--)
            {
                DateOnly day = AddWorkingDays(today, -dayIndex);
                bool away = requests.Any(request =>
                    request.Member == member
                    && request.Decision?.Kind == "approve"
                    && request.Absence == DemoAbsence.Vacation
                    && day >= request.From
                    && day <= request.To);
                if (away)
                {
                    continue;
                }

                // Small, repeatable variations, so the timesheets do not look machine made.
                int variation = ((person * 7) + (dayIndex * 3)) % 5;
                WorkLocation location = (person + dayIndex) % 3 == 0 ? WorkLocation.HomeOffice : WorkLocation.Office;
                DateTimeOffset start = new DateTimeOffset(day, new TimeOnly(7, 0), TimeSpan.Zero)
                    .AddMinutes((variation * 10) - 20);
                DateTimeOffset breakStart = start.AddMinutes(Math.Min(240 + (variation * 5), dailyMinutes));
                DateTimeOffset resume = breakStart.AddMinutes(BreakMinutes);
                DateTimeOffset end = start.AddMinutes(dailyMinutes + BreakMinutes + ((variation - 2) * 4));

                (TimeBookingType Type, DateTimeOffset At)[] events =
                [
                    (TimeBookingType.ClockIn, start),
                    (TimeBookingType.StartBreak, breakStart),
                    (TimeBookingType.ResumeWork, resume),
                    (TimeBookingType.ClockOut, end),
                ];

                foreach ((TimeBookingType type, DateTimeOffset at) in events)
                {
                    WorkLocation? bookedLocation = type == TimeBookingType.ClockIn ? location : null;
                    bookings.Add(TimeBooking.Create(
                        tenantId,
                        member.Employee.Id,
                        type,
                        at,
                        at,
                        bookedLocation,
                        BookingSource.Web,
                        $"demo-{member.Employee.PersonnelNumber}-{day:yyyy-MM-dd}-{type}"));
                    state.Apply(type, at, bookedLocation);
                }
            }

            states.Add(state);
        }

        return (bookings, states);
    }

    private static (List<ClientAggregate> Records, List<OutboxMessage> Events) BuildRecords(
        Guid tenantId,
        IReadOnlyList<DemoRequest> requests,
        DateTimeOffset now)
    {
        List<ClientAggregate> records = [];
        List<OutboxMessage> events = [];

        void Add(string aggregate, string id, string operationType, object payload, Guid ownerUserId, DateTimeOffset at)
        {
            string operationId = $"{SyncClientId}-{aggregate}-{id}";
            string payloadJson = JsonSerializer.Serialize(payload, JsonOptions);
            ClientAggregate record = new(tenantId, aggregate, id, payloadJson, operationId, at, ownerUserId);
            records.Add(record);
            events.Add(new OutboxMessage(
                tenantId,
                "client-aggregate.upserted.v1",
                aggregate,
                ClientAggregateIds.Stable(aggregate, id),
                JsonSerializer.Serialize(
                    new ClientAggregateSyncEvent(
                        aggregate,
                        id,
                        operationType,
                        Deleted: false,
                        JsonSerializer.Deserialize<JsonElement>(payloadJson),
                        operationId,
                        SyncClientId,
                        record.ServerVersion,
                        now,
                        ownerUserId),
                    JsonOptions),
                now));
        }

        foreach (DemoRequest request in requests)
        {
            EmployeeRequestDocument document = request.ToDocument();
            Add(
                "request",
                document.Id,
                request.Decision is null ? "request.submit" : $"request.{request.Decision.Kind}",
                document,
                request.Member.User.Id,
                document.UpdatedAt);

            if (document.Status == "approved")
            {
                string absenceId = $"absence-{document.Id}";
                Add(
                    "absence",
                    absenceId,
                    "absence.upsert",
                    new
                    {
                        id = absenceId,
                        requestId = document.Id,
                        employeeId = document.EmployeeId,
                        employeeName = document.EmployeeName,
                        fromDate = document.FromDate,
                        toDate = document.ToDate,
                        statusTypeId = document.StatusTypeId,
                        statusCode = document.StatusCode,
                        statusLabel = document.StatusLabel,
                        subtype = document.Subtype,
                        partialDay = document.PartialDay,
                        reason = document.Reason,
                        source = "approved-request",
                        approvedAt = document.UpdatedAt,
                        syncState = "synced",
                    },
                    request.Member.User.Id,
                    document.UpdatedAt);
            }
        }

        return (records, events);
    }

    /// <summary>The status types every workspace starts with, as the web app defines them.</summary>
    private sealed record DemoAbsence(string StatusTypeId, string Code, string Label)
    {
        public static readonly DemoAbsence Vacation = new("vac", "VAC", "Vacation");

        public static readonly DemoAbsence HomeOffice = new("ho", "HO", "Home office");
    }

    private sealed record DemoDecision(string Kind, DemoMember DecidedBy, DateTimeOffset DecidedAt, string? Comment);

    private sealed record DemoRequest(
        DemoMember Member,
        DemoAbsence Absence,
        DateOnly From,
        DateOnly To,
        string Reason,
        DateTimeOffset SubmittedAt,
        DemoDecision? Decision)
    {
        public EmployeeRequestDocument ToDocument() =>
            new(
                $"request-{Member.Employee.PersonnelNumber}-{From:yyyy-MM-dd}",
                "absence",
                Member.User.Id,
                Member.User.DisplayName,
                From,
                To,
                Absence.StatusTypeId,
                Absence.Code,
                Absence.Label,
                Absence.Label,
                ClockIn: null,
                ClockOut: null,
                ProposedEvents: null,
                PartialDay: null,
                Recurrence: null,
                SeriesId: null,
                Attachments: [],
                Reason,
                Decision switch
                {
                    null => "submitted",
                    { Kind: "approve" } => "approved",
                    _ => "rejected",
                },
                SubmittedAt,
                Decision?.DecidedAt ?? SubmittedAt,
                Decision is null
                    ? null
                    : new RequestDecisionSummary(
                        Decision.Kind,
                        Decision.DecidedBy.User.Id,
                        Decision.DecidedBy.User.DisplayName,
                        Decision.DecidedAt,
                        Decision.Comment),
                ApprovalFlow: null,
                "synced");
    }
}
