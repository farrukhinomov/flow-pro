data "oci_objectstorage_namespace" "this" {
  compartment_id = var.compartment_ocid
}

resource "oci_objectstorage_bucket" "backups" {
  compartment_id = var.compartment_ocid
  namespace      = data.oci_objectstorage_namespace.this.namespace
  name           = "${var.name}-backups"
  access_type    = "NoPublicAccess"
  versioning     = "Disabled"
}

# Old backups are deleted by the bucket itself, so the server never needs
# permission to delete anything.
resource "oci_objectstorage_object_lifecycle_policy" "backups" {
  namespace = data.oci_objectstorage_namespace.this.namespace
  bucket    = oci_objectstorage_bucket.backups.name

  rules {
    name        = "expire-old-backups"
    action      = "DELETE"
    is_enabled  = true
    time_amount = var.backup_retention_days
    time_unit   = "DAYS"
  }

  depends_on = [oci_identity_policy.lifecycle]
}

# The server authenticates to Object Storage as itself (instance principal),
# so no long-lived credential is stored on it. It may only create objects in
# the backup bucket.
resource "oci_identity_dynamic_group" "app" {
  compartment_id = var.tenancy_ocid
  name           = "${var.name}-app-instance"
  description    = "The FlowPro application server"
  matching_rule  = "instance.id = '${oci_core_instance.app.id}'"
}

resource "oci_identity_policy" "backups" {
  compartment_id = var.compartment_ocid
  name           = "${var.name}-backups"
  description    = "Lets the FlowPro server upload database backups"
  statements = [
    "Allow dynamic-group ${oci_identity_dynamic_group.app.name} to manage objects in compartment id ${var.compartment_ocid} where all {target.bucket.name = '${oci_objectstorage_bucket.backups.name}', any {request.permission = 'OBJECT_CREATE', request.permission = 'OBJECT_INSPECT'}}",
  ]
}

# Object Storage itself needs permission to apply the lifecycle rule.
resource "oci_identity_policy" "lifecycle" {
  compartment_id = var.compartment_ocid
  name           = "${var.name}-backup-lifecycle"
  description    = "Lets Object Storage delete expired FlowPro backups"
  statements = [
    "Allow service objectstorage-${var.region} to manage object-family in compartment id ${var.compartment_ocid} where target.bucket.name = '${oci_objectstorage_bucket.backups.name}'",
  ]
}
