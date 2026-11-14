# Single entry point for local and CI image builds (docs/master-plan/ci-cd.md section 8).
#   SERVICE_REVISION="$(git rev-parse HEAD)" SOURCE_DATE_EPOCH="$(git log -1 --format=%ct)" \
#     VERSION="$(node -p "require('./package.json').version")" docker buildx bake --load
# Nothing here pushes: publication happens only in the release workflow (M7), by digest.

variable "SERVICE_REVISION" {
  default = "unknown"
}

variable "VERSION" {
  default = "0.0.0-dev"
}

# Commit time; "0" keeps a local build reproducible when unset.
variable "SOURCE_DATE_EPOCH" {
  default = "0"
}

group "default" {
  targets = ["app", "postgres"]
}

target "_common" {
  context   = "."
  platforms = ["linux/amd64"]
  args = {
    SERVICE_REVISION  = SERVICE_REVISION
    VERSION           = VERSION
    SOURCE_DATE_EPOCH = SOURCE_DATE_EPOCH
  }
}

target "app" {
  inherits   = ["_common"]
  dockerfile = "infra/docker/app/Dockerfile"
  tags       = ["pequeverso-backoffice:rc"]
}

target "postgres" {
  inherits   = ["_common"]
  dockerfile = "infra/docker/postgres/Dockerfile"
  tags       = ["pequeverso-backoffice-postgres:rc"]
}
