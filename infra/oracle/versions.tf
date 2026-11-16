terraform {
  required_version = ">= 1.8.0"

  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 9.11"
    }
  }

  # State holds resource identifiers, so keep it out of the repository. This
  # stores it in an Oracle Object Storage bucket through its S3-compatible API.
  # Create the bucket once by hand and fill in backend.hcl (see README.md).
  backend "s3" {}
}

provider "oci" {
  region = var.region
}
