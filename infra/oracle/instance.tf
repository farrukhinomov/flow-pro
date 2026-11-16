data "oci_identity_availability_domains" "all" {
  compartment_id = var.compartment_ocid
}

# Latest Ubuntu 24.04 image built for the ARM shape.
data "oci_core_images" "ubuntu" {
  compartment_id           = var.compartment_ocid
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "24.04"
  shape                    = "VM.Standard.A1.Flex"
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

resource "oci_core_instance" "app" {
  compartment_id      = var.compartment_ocid
  availability_domain = data.oci_identity_availability_domains.all.availability_domains[var.availability_domain_index].name
  display_name        = "${var.name}-app"
  shape               = "VM.Standard.A1.Flex"

  shape_config {
    ocpus         = var.instance_ocpus
    memory_in_gbs = var.instance_memory_gb
  }

  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.ubuntu.images[0].id
    boot_volume_size_in_gbs = var.boot_volume_gb
  }

  create_vnic_details {
    subnet_id = oci_core_subnet.public.id
    # The public address is the reserved IP below, so it survives a rebuild.
    assign_public_ip = false
  }

  metadata = {
    ssh_authorized_keys = var.admin_ssh_public_key
    user_data = base64encode(templatefile("${path.module}/cloud-init.yaml.tftpl", {
      deploy_ssh_public_key = var.deploy_ssh_public_key
      deploy_script         = file("${path.module}/../deploy/flowpro-deploy.sh")
      backup_script         = file("${path.module}/../deploy/flowpro-backup.sh")
      repository_url        = var.repository_url
      backup_bucket         = oci_objectstorage_bucket.backups.name
      backup_namespace      = data.oci_objectstorage_namespace.this.namespace
    }))
  }

  lifecycle {
    # A newer base image or an edited cloud-init must not replace a running
    # server. Rebuild deliberately with `tofu apply -replace`.
    ignore_changes = [source_details[0].source_id, metadata["user_data"]]
  }
}

data "oci_core_vnic_attachments" "app" {
  compartment_id = var.compartment_ocid
  instance_id    = oci_core_instance.app.id
}

data "oci_core_private_ips" "app" {
  vnic_id = data.oci_core_vnic_attachments.app.vnic_attachments[0].vnic_id
}

resource "oci_core_public_ip" "app" {
  compartment_id = var.compartment_ocid
  display_name   = "${var.name}-app"
  lifetime       = "RESERVED"
  private_ip_id  = data.oci_core_private_ips.app.private_ips[0].id
}
