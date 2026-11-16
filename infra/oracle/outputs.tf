output "public_ip" {
  description = "Reserved public address. Point the DNS records of your domains at it."
  value       = oci_core_public_ip.app.ip_address
}

output "backup_bucket" {
  description = "Object Storage bucket that receives the nightly database backups."
  value       = oci_objectstorage_bucket.backups.name
}

output "ssh_admin" {
  description = "How to open an administrator shell."
  value       = "ssh ubuntu@${oci_core_public_ip.app.ip_address}"
}
