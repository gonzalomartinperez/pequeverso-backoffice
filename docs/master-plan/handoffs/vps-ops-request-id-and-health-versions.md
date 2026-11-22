# Handoff: request id and health versions in the backoffice deployment contract

- From: `pequeverso-backoffice` (roadmap M4.7)
- To: `vps-ops` (reverse proxy, probes, release checks)
- Date: 2026-11-22
- Kind: expand only. Existing probes keep working unchanged.

## What changed in the contract ([deployment contract](../../deployment-contract.md))

- `GET /healthz` and `GET /readyz` bodies add `version` (the image's `VERSION` build label) and
  `schema_version` (the newest migration the build expects, today `0002`). The status codes and
  `status` values are unchanged.
- Every response carries `x-request-id`. A well-formed incoming value (8 to 64 characters from
  `A-Z a-z 0-9 . _ -`) is kept; anything else is replaced with a UUID. The backoffice forwards it
  to the private API calls, sets it on spans (`request.id`) and writes it as `request_id` in
  structured logs.

## Requests for `vps-ops` (when the VPS work resumes, MV)

1. Optional: have the reverse proxy set or pass a request id upstream, and log the response's
   `x-request-id` in access logs. Do not strip the response header.
2. Optional: release checks may compare `/readyz` `version` with the deployed tag and
   `schema_version` with the migration job's level, as part of the post-deploy evidence
   (ecosystem 18.2 step 7).

No change is required to keep the current checks green.

## Status

Open. Delivered to the orchestrator through the M4 run report.
