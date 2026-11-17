# Third-party packages

FlowPro Server uses only free and open-source NuGet packages. FlowPro itself
is licensed under AGPL-3.0-only. CI enforces an allow-list of dependency
licences on every pull request: `allowed-licenses.json` for NuGet packages and
the `licenses` script in `apps/web/package.json` for npm packages.

This notice is a developer aid, not a substitute for legal review. Validate
third-party licenses before production release and whenever dependency versions
change.

| Package family | Purpose | License |
| --- | --- | --- |
| Microsoft ASP.NET Core and .NET packages | API, authentication, OpenAPI, hosting | MIT |
| Microsoft Entity Framework Core | Persistence and migrations | MIT |
| Npgsql Entity Framework Core provider | PostgreSQL provider | PostgreSQL License |
| MailKit and MimeKit | Sending email over SMTP | MIT |
| OpenTelemetry .NET | Traces, metrics and logs over OTLP, off by default | Apache-2.0 |
| xUnit.net | Testing | Apache-2.0 |
| coverlet | Test coverage collection | MIT |
| PostgreSQL container image | Database | PostgreSQL License |
| pgAdmin container image | Local database administration UI | PostgreSQL License |
| Mailpit container image | Local mail catcher for development | MIT |
| Caddy container image | Web server, reverse proxy and automatic TLS | Apache-2.0 |

Package versions are centrally pinned in `Directory.Packages.props`. Run
`dotnet list FlowPro.slnx package --vulnerable --include-transitive` before
releases.

## Storage Licensing Position

FlowPro stores attachments on a local volume by default and bundles no object
store. Production storage
is provider-configurable through the attachment storage abstraction. Operators
must validate the selected provider's current license, support model, data
processing terms, retention features, and backup capabilities.

See:

- `docs/architecture/backend/storage-decision-matrix.md`
- `docs/self-hosting/admin-guide.md`
- `docs/self-hosting/backup-restore.md`
