# Infrastructure

Everything needed to run FlowPro on one server in Oracle Cloud, defined as
code with [OpenTofu](https://opentofu.org).

```text
infra/
├── oracle/     network, server, reserved IP, backup bucket and its permissions
└── deploy/     scripts installed on the server: deploy and nightly backup
```

The defaults fit Oracle's Always Free allowance: one Ampere A1 (ARM) instance
with 2 OCPUs, 12 GB of memory and a 50 GB disk.

## What it creates

- A virtual network with one public subnet. Inbound traffic is limited to SSH
  (22), HTTP (80) and HTTPS (443).
- One Ubuntu 24.04 ARM server with a reserved public IP address.
- On first boot the server installs Docker Engine, creates a `deploy` account,
  installs the deploy and backup scripts, and clones this repository to
  `/opt/flowpro`.
- A private Object Storage bucket for nightly database backups. Backups older
  than 14 days are deleted by the bucket. The server can only add objects to
  it, and authenticates as itself, so no storage credential is kept on it.

## Access model

| Who | Account | What the key can do |
| --- | --- | --- |
| You | `ubuntu` | Full administrator shell. |
| The deploy pipeline | `deploy` | Run `/usr/local/bin/flowpro-deploy <image tag>` and nothing else. |

Password login and root login are disabled.

## First-time setup

1. Install OpenTofu and the Oracle Cloud CLI, and configure the CLI
   (`oci setup config`). OpenTofu uses the same credentials.
2. Create two SSH key pairs: one for yourself and one for the deploy pipeline.

   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/flowpro-admin
   ssh-keygen -t ed25519 -f ~/.ssh/flowpro-deploy -N ""
   ```

3. In the Oracle console, create a bucket for the OpenTofu state and a
   Customer Secret Key. Copy `oracle/backend.hcl.example` to
   `oracle/backend.hcl` and fill it in.
4. Copy `oracle/terraform.tfvars.example` to `oracle/terraform.tfvars` and
   fill it in.
5. Create the infrastructure:

   ```bash
   cd infra/oracle
   tofu init -backend-config=backend.hcl
   tofu plan
   tofu apply
   ```

6. Point the DNS records of your domains at the `public_ip` output.
7. Open an administrator shell (`ssh_admin` output), create
   `/opt/flowpro/.env` as described in
   [public deployment](../docs/self-hosting/public-deployment.md), and make it
   readable only by `deploy`:

   ```bash
   sudo -u deploy nano /opt/flowpro/.env
   sudo chmod 600 /opt/flowpro/.env
   ```

8. Deploy a version:

   ```bash
   ssh -i ~/.ssh/flowpro-deploy deploy@<public_ip> 1.0.0
   ```

## Continuous deployment from GitHub

The `Images` workflow can deploy every commit on the default branch. Configure
the repository once:

| Kind | Name | Value |
| --- | --- | --- |
| Environment | `demo` | Add required reviewers if deploys should wait for approval. |
| Environment secret | `DEMO_DEPLOY_SSH_KEY` | The private deploy key. |
| Environment secret | `DEMO_SSH_KNOWN_HOSTS` | Output of `ssh-keyscan <public_ip>`. |
| Variable | `DEMO_SSH_HOST` | The server's public IP or host name. |
| Variable | `DEMO_DOMAIN` | The domain the app is served on. |
| Variable | `DEMO_DEPLOY_ENABLED` | `true` to turn deployment on. |

## Notes

- **Capacity.** Always Free A1 capacity is often exhausted in a region. If
  `tofu apply` reports "Out of host capacity", try another
  `availability_domain_index` or retry later.
- **Home region.** The dynamic group and policies are identity resources. If
  `region` is not your tenancy's home region, creating them fails; run OpenTofu
  against the home region or create those two resources there.
- **Rebuilding.** A changed base image or first-boot script does not replace a
  running server. Rebuild deliberately with
  `tofu apply -replace=oci_core_instance.app`. The reserved IP is kept.
- **Restores** are described in
  [backup and restore](../docs/self-hosting/backup-restore.md). Download a
  backup with `oci os object get` and restore it with `pg_restore`.
