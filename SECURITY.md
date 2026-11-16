# Security Policy

FlowPro is an open-source product with a public demo. It handles workforce data
by design, so security reports are taken seriously.

## Reporting a Vulnerability

Please do not open a public issue. Use GitHub's
[private vulnerability reporting](https://github.com/farrukhinomov/flow-pro/security/advisories/new)
instead. You can expect a first response within 7 days.

## Scope

- The code in this repository.
- The public demo linked from the README. Do not run load tests or automated
  scanners against it, and do not access data that belongs to other demo
  accounts.

Credentials that appear in `compose.yaml`, `.env.example` and the development
settings (`superadmin`, `*@flowpro.local`) are local development defaults and
are not used by the public demo.
