variable "region" {
  description = "Oracle Cloud region identifier, for example eu-frankfurt-1."
  type        = string
}

variable "compartment_ocid" {
  description = "OCID of the compartment that holds every FlowPro resource."
  type        = string
}

variable "availability_domain_index" {
  description = "Which availability domain of the region to use, counted from 0. Always Free A1 capacity is often only available in one of them."
  type        = number
  default     = 0
}

variable "name" {
  description = "Prefix for resource names."
  type        = string
  default     = "flowpro"
}

variable "instance_ocpus" {
  description = "OCPUs for the instance. The Always Free allowance is 4 OCPUs across all A1 instances."
  type        = number
  default     = 2
}

variable "instance_memory_gb" {
  description = "Memory in GB. The Always Free allowance is 24 GB across all A1 instances."
  type        = number
  default     = 12
}

variable "boot_volume_gb" {
  description = "Boot volume size in GB. The Always Free allowance is 200 GB of block storage in total."
  type        = number
  default     = 50
}

variable "admin_ssh_public_key" {
  description = "SSH public key for the administrator account (ubuntu). Use your own key, not the deploy key."
  type        = string
}

variable "deploy_ssh_public_key" {
  description = "SSH public key used by the deploy pipeline. On the server it can only run the deploy script."
  type        = string
}

variable "admin_ssh_source_cidr" {
  description = "Address range allowed to reach SSH. It must stay open to the internet for hosted CI runners; access is restricted by key and, for the deploy key, by a forced command."
  type        = string
  default     = "0.0.0.0/0"
}

variable "repository_url" {
  description = "Git URL the server clones to get the compose files."
  type        = string
  default     = "https://github.com/farrukhinomov/flow-pro.git"
}

variable "backup_retention_days" {
  description = "Days to keep nightly database backups in Object Storage."
  type        = number
  default     = 14
}

variable "tenancy_ocid" {
  description = "OCID of the tenancy. The dynamic group that identifies the server is created at tenancy level."
  type        = string
}
