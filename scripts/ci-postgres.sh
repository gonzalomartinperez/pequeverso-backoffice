#!/usr/bin/env bash
# Starts the disposable PostgreSQL used by the CI database and browser jobs (test-only credentials,
# loopback port, tmpfs data) and waits until it accepts connections.
set -euo pipefail

docker run -d --name postgres -e POSTGRES_USER=backoffice -e POSTGRES_PASSWORD=ci-only \
  -e POSTGRES_DB=backoffice_test -p 127.0.0.1:5432:5432 --tmpfs /var/lib/postgresql \
  postgres:18.6-trixie@sha256:885953109528ad3dfc90362b1a6f50a78620b5315be19f187753d267e484dc5b >/dev/null
for _ in $(seq 1 30); do
  docker exec postgres pg_isready -h 127.0.0.1 -U backoffice -d backoffice_test >/dev/null 2>&1 && exit 0
  sleep 1
done
docker logs postgres
exit 1
