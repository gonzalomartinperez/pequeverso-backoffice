#!/usr/bin/env bash
# Visual regression runner (M2.7). The production stack runs on the host (Node from .nvmrc, the
# same stack as the browser suite); Playwright runs in the pinned image so pixels never depend on
# the host. Needs a built `.next`, `npm ci`, Docker and TEST_DATABASE_URL (a disposable PostgreSQL).
# Usage: scripts/visual.sh [playwright args, e.g. --update-snapshots]
set -euo pipefail

# Pinned by digest; tag v1.64.1-noble matches @playwright/test 1.64.1 (tests/unit/ci-profile.test.ts).
IMAGE="mcr.microsoft.com/playwright:v1.64.1-noble@sha256:2f05f8a734509a7b3f26a912639488ee08f58a7b292d14d62271bcff9038768f"

: "${TEST_DATABASE_URL:?TEST_DATABASE_URL must point at a disposable PostgreSQL}"
cd "$(dirname "$0")/.."

# A listener already on 3241 would answer the readiness probe for a stack that is not ours.
if curl -fsS --max-time 2 http://localhost:3241/healthz >/dev/null 2>&1; then
  echo "port 3241 is already serving; stop that server first" >&2
  exit 1
fi

node scripts/backoffice-stack.ts &
stack=$!
# shellcheck disable=SC2329 # invoked through the EXIT trap
cleanup() {
  kill -TERM "$stack" 2>/dev/null || true
  wait "$stack" 2>/dev/null || true
}
trap cleanup EXIT

ready=0
for _ in $(seq 1 90); do
  kill -0 "$stack" 2>/dev/null || { echo "stack exited before it was ready" >&2; exit 1; }
  if curl -fsS --max-time 2 http://localhost:3241/healthz >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
test "$ready" = 1 || { echo "stack did not become ready" >&2; exit 1; }

status=0
docker run --rm --init --ipc=host --network host --user "$(id -u):$(id -g)" \
  -e HOME=/tmp -e CI="${CI:-}" -v "$PWD":/work -w /work "$IMAGE" \
  npx playwright test --config playwright.visual.config.ts "$@" || status=$?
# The stack must still be alive at the end: a crash mid-run would make the pixels meaningless.
kill -0 "$stack" 2>/dev/null || { echo "stack exited during the visual run" >&2; status=1; }
exit "$status"
