# Handoff: optional per-run stage spans in the ops contract

- From: `pequeverso-backoffice` (roadmap M4.9, PVB-D5; [ADR 0016](../../decisions/0016-run-detail-without-stage-spans.md))
- To: `pequeverso-assistant-api` (producer of `contracts/ops.schema.json`)
- Date: 2026-11-22
- Priority: low. Backoffice M5 ships without it.
- Kind: expand only (ecosystem section 18). Additive and optional; no existing field changes.

## Request

Add an optional `stages` array to each item of `recent` (`RecentRunOut`) so the backoffice can show
where a run spent its time. Suggested shape; the producer decides the final names:

```json
"stages": [
  { "name": "retrieve", "offset_ms": 0, "duration_ms": 42, "outcome": "ok" },
  { "name": "model_call", "offset_ms": 42, "duration_ms": 1810, "outcome": "ok" }
]
```

- `name`: a closed enum owned by the API (for example `retrieve`, `model_call`, `check_content`,
  `finalize`). No free text.
- `offset_ms` and `duration_ms`: non-negative integers measured by the producer. No derived or
  estimated values.
- `outcome`: a closed enum, for example `ok`, `failed` or `skipped`.
- Privacy is unchanged: no prompts, answers, retrieved text, product data, buyer data or
  identifiers beyond the existing opaque run id.
- Absent or `null` means "not measured". The backoffice shows "No disponible", never zero.

## Consumer side (this repository)

- Today: `tests/unit/stage-spans.test.ts` pins the absence of the field. The validator ignores
  unknown fields, so releasing the field cannot break the backoffice.
- After the API releases the expansion: re-pin `contracts/ops/` from the released revision in a
  `contract` profile PR. Then extend the validator and the run detail view, and supersede ADR 0016.
  No consumer work starts before the release.

## Status

Open. Delivered to the orchestrator through the M4 run report for the API's lead.
