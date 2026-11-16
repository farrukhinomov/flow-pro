# Quality Discipline

FlowPro should not build a silent bug backlog. Bugs are product work, not
background noise.

## Bug SLA

| Severity | Examples | SLA |
| --- | --- | --- |
| High | legal attendance evidence wrong or missing, payroll export incorrect, auth bypass, tenant data leak, production outage | fix or mitigate within 48 hours |
| Normal | broken workflow, confusing but recoverable UI, failed local cache refresh, non-critical report mismatch | fix within 7 days |
| Low | copy polish, minor visual issue, harmless noisy log | schedule intentionally or close with rationale |

## Rules

1. Every confirmed bug has an owner.
2. Every confirmed bug has severity.
3. High severity bugs interrupt feature work.
4. Normal bugs should not sit longer than seven days.
5. Do not hide known bugs in TODO comments.
6. If a bug is accepted as not worth fixing, record the decision.
7. Weekly review must include open bug count, high severity count, oldest bug,
   and recurring root causes.

## Weekly Bug Dashboard

Track at least:

- total open bugs
- high severity bugs
- bugs older than seven days
- bugs by product area
- bugs caused by missing tests
- bugs caused by unclear requirements
- bugs caused by data migration/sync behavior

FlowPro also exposes a product-facing Quality Health dashboard under Settings.
It combines local-first health with backend source-of-truth signals so bugs and
sync failures are visible instead of hiding in logs.

Dashboard signals:

- local audit integrity
- local pending and failed outbox operations
- projection hydration failures
- local schema version
- last successful client sync and last client sync error
- backend operations reachability
- backend pending and failed outbox counts
- latest backend audit event and projection update
- last backend outbox error

Until a dedicated issue tracker is connected, the dashboard derives its bug
counts from confirmed local bug records when present. A confirmed bug record has:

- owner
- severity
- product area
- created timestamp
- status

If no confirmed bug records exist, the dashboard falls back to current quality
issues:

- critical quality issues count as high severity bugs
- warning quality issues count as normal bugs
- product areas are inferred from the affected signal
- oldest bug age is `0` because inferred bugs do not yet have creation
  timestamps

If this dashboard reports `critical`, treat it like a high-severity quality
signal until an owner confirms the cause and records the decision.

Suggested product areas:

- Attendance
- Requests
- Timesheets
- Payroll
- Users and access
- Organization
- Planning
- Reports
- Sync and local cache
- Authentication
- Deployment and operations

## Engineering Response

For each fixed bug:

1. Add the smallest regression test that would have caught it.
2. Fix the root cause, not only the symptom.
3. Update docs if the expected behavior was unclear.
4. Check whether related workflows share the same defect.
5. Include the bug ID or issue reference in the change summary.

## Release Gate

Do not ship a release with unresolved high severity bugs unless the release is
itself the mitigation.

## Flaky Tests

A test that fails without a code change is a defect in its own right, and it is
treated as one. Retries are cover for genuine infrastructure blips, never a way
to live with an unreliable test.

This rule exists because the opposite was true for a while. The visual sweep
failed roughly three runs in four. With two retries configured, CI still passed
it about three-fifths of the time, so nobody traced it — and the suite quietly
taught the team to discount a red run. The underlying cause turned out to be a
real product defect: the authenticated layout awaited `GET /onboarding/state`
before rendering, so every page's first paint waited on a network round-trip.
The flake had been reporting a genuine bug the whole time and was ignored
because it cried wolf.

### Rules

1. A test that fails without a related code change gets an owner within one
   working day.
2. It is either fixed, or removed from the required set with a linked issue.
   It is never left retrying silently.
3. Investigate before quarantining. Assume the test is right until shown
   otherwise; the two most expensive bugs found so far were both first reported
   by a test that looked flaky.
4. Establish flakiness with repeated runs, never a single pass. A single green
   run is not a control, and treating one as such has already produced a wrong
   diagnosis and hours of misdirected work.
5. Retries stay at one. Enough to absorb an infrastructure blip, not enough to
   hide a failure rate.
6. CI reports pass-on-retry as flaky. A test that failed and then passed must
   never look identical to one that never failed.

## Performance Regressions

Latency changes are invisible to lint, types, unit tests, and the build. Two
significant regressions reached `main` while every one of those gates was
green, and both surfaced only as an "element not found" timeout — which reads
as a broken page rather than a slow one, and cost hours to trace.

### Rules

1. `e2e/performance-budget.spec.ts` asserts a first-paint ceiling for every
   authenticated route. It prints every route's timing on each run, so creep is
   visible before it breaches the ceiling.
2. The budget is a regression alarm, not a target. Keep roughly an order of
   magnitude of headroom so the guard never becomes a flake itself.
3. A change described as an optimization does not merge without a measurement.
   One regression here was a formatter cache added with a confident comment
   about `Intl` being expensive, never benchmarked, and six times slower than
   the code it replaced — `Intl` constructors are already memoized by the
   engine.
4. Claims about performance and about causation need a number and a repeat.
