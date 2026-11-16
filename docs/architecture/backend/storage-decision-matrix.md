# Production Storage Decision Matrix

FlowPro stores employee documents, request attachments, payroll exports, and
future import files through an application-level storage abstraction. The
backend must never assume a specific object storage vendor is the legal or
technical default for production.

This document is operational guidance, not legal advice. Validate final
production choices with counsel and the selected storage provider's current
terms.

## Recommended Defaults

| Scenario | Recommended storage | Why | Notes |
| --- | --- | --- | --- |
| Local development | Local filesystem | Fast, cheap, reproducible | Use only development credentials and disposable data. |
| Self-hosted demo | Local filesystem | Simple Docker Compose onboarding | Mark as demo/non-critical unless the customer accepts storage operations and licensing. |
| Self-hosted production | Customer-provided S3-compatible storage | Customer controls legal, backup, retention, and data residency obligations | FlowPro should document requirements, not bundle a mandatory provider. |
| SaaS production, Germany first | EU-hosted S3-compatible provider or Azure Blob/AWS S3 in EU region | Stronger operational support and clearer production terms | Prefer providers with DPA, ISO 27001, backup durability, and audit logging. |
| Enterprise regulated customers | Provider selected by customer procurement/security | Contractual compliance matters more than developer convenience | Require retention, encryption, access logging, restore tests, and breach process. |

## Bundled Storage Position

FlowPro bundles no object store. Attachments are stored on a local volume by
default. An operator who needs object storage chooses an S3-compatible provider
and is responsible for its licence, backups, monitoring, upgrades, credentials
and incident response.

## Production Storage Requirements

- Server-side authorization must protect every upload, download, and delete.
- Object keys must be tenant-scoped and must not expose customer names, employee
  names, or request reasons.
- Metadata belongs in PostgreSQL; object storage contains bytes only.
- Deletes are soft-deletes first. Physical purge follows the configured
  retention period.
- Production storage must support backups or cross-region/object replication
  appropriate to the customer's recovery requirements.
- Encryption at rest and TLS in transit are required.
- Access keys must be unique per environment and rotated without code changes.
- FlowPro must not use root/admin object storage credentials for application
  traffic in production.

## Implementation Policy

Use these provider names in configuration:

```text
AttachmentStorage__Provider=Local
AttachmentStorage__Provider=S3Compatible
AttachmentStorage__Provider=AzureBlob
```

`Local` is for development and small self-hosted demos. `S3Compatible` is the
preferred production abstraction. `AzureBlob` can be added when SaaS deployment
needs direct Azure support.

## Decision Checklist

- Is there a signed DPA and clear data residency commitment?
- Are support and incident response times acceptable for payroll/HR data?
- Are backups and restore tests documented?
- Can credentials be rotated safely?
- Are audit logs available for object access and administrative actions?
- Does the license allow this production use case?
- Can the customer export all data and attachments before termination?
