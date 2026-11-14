#!/usr/bin/env bash
# Checks the OCI labels and runtime metadata of the images built by docker-bake.hcl, and that the
# PostgreSQL IAM artifact reports healthy through its own HEALTHCHECK. Synthetic credentials only.
#   SERVICE_REVISION=<sha> VERSION=<x.y.z> scripts/check-image-metadata.sh [app-image] [postgres-image]
set -euo pipefail

APP="${1:-pequeverso-backoffice:rc}"
PG="${2:-pequeverso-backoffice-postgres:rc}"
: "${SERVICE_REVISION:?set SERVICE_REVISION}" "${VERSION:?set VERSION}"
DB="pv-bo-health-$$"
trap 'docker rm -f "$DB" >/dev/null 2>&1 || true' EXIT

label() { docker image inspect --format "{{ index .Config.Labels \"org.opencontainers.image.$2\" }}" "$1"; }
expect() { [ "$2" = "$3" ] || { echo "$1: expected '$3', got '$2'" >&2; exit 1; }; }

for image in "$APP" "$PG"; do
  expect "$image revision" "$(label "$image" revision)" "$SERVICE_REVISION"
  expect "$image version" "$(label "$image" version)" "$VERSION"
  expect "$image source" "$(label "$image" source)" "https://github.com/gonzalomartinperez/pequeverso-backoffice"
done
expect "$APP title" "$(label "$APP" title)" "pequeverso-backoffice"
expect "$APP licenses" "$(label "$APP" licenses)" "MIT"
env_of() { docker image inspect --format '{{ range .Config.Env }}{{ println . }}{{ end }}' "$1"; }
env_of "$APP" | grep -qx "SERVICE_REVISION=$SERVICE_REVISION" || { echo "app env lacks SERVICE_REVISION" >&2; exit 1; }
env_of "$APP" | grep -qx "VERSION=$VERSION" || { echo "app env lacks VERSION" >&2; exit 1; }
expect "$APP user" "$(docker image inspect --format '{{ .Config.User }}' "$APP")" "65532:65532"
expect "$PG user" "$(docker image inspect --format '{{ .Config.User }}' "$PG")" "999:999"
[ -n "$(docker image inspect --format '{{ if .Config.Healthcheck }}{{ .Config.Healthcheck.Test }}{{ end }}' "$PG")" ] \
  || { echo "$PG has no HEALTHCHECK" >&2; exit 1; }

docker run -d --name "$DB" -e POSTGRES_USER=backoffice -e POSTGRES_PASSWORD="health-only-$$" \
  -e POSTGRES_DB=backoffice --tmpfs /var/lib/postgresql:uid=999,gid=999 "$PG" >/dev/null
for _ in $(seq 1 60); do
  status="$(docker inspect --format '{{ .State.Health.Status }}' "$DB")"
  [ "$status" = healthy ] && { echo "Image metadata and PostgreSQL health check: ok"; exit 0; }
  sleep 2
done
docker logs "$DB" | tail -20 >&2
echo "PostgreSQL IAM image never reported healthy (last: $status)" >&2
exit 1
