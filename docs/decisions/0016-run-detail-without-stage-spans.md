# ADR 0016: Run detail without per-stage spans until the API contract adds them

- Status: accepted
- Date: 2026-11-22
- Task: M4.9 (roadmap), PVB-D5

## Context and problem statement

The planned run detail view (M5) could show a per-stage waterfall: retrieval, model call,
content checks, finalization. The ops contract (`contracts/ops/ops.schema.json`, `RecentRunOut`)
has no per-stage data. A run carries only `started_at`, `first_delta_ms`, `total_ms`, outcome,
code, language and two flags. Should the backoffice wait for stage data, derive it, or ship
without it?

## Considered options

1. Ship run detail with the fields the contract has; ask the API for optional stage spans
   (expand only) and consume them only after the API releases them.
2. Derive stages in the backoffice from the timings it has.
3. Read the API's traces or logs directly.

## Decision outcome

Option 1. The UI shows what the contract states: first-answer and total time, outcome and code.
It shows no waterfall and no invented split. Deriving stages from two timings would display
numbers the producer never measured (option 2). Reading traces or logs would bypass the pinned
contract and its privacy review (option 3), which `AGENTS.md` forbids.

The request is recorded in
[`docs/master-plan/handoffs/pequeverso-assistant-api-stage-spans.md`](../master-plan/handoffs/pequeverso-assistant-api-stage-spans.md)
for the API's owner. It is low priority: M5 does not depend on it.

### Consequences

- Good: no fabricated timing data; the contract stays the single source.
- Good: the validator ignores unknown fields, so an additive `stages` field cannot break the
  backoffice before it is consumed.
- Bad: run detail is less diagnostic until the API ships the expansion.

### Confirmation

`tests/unit/stage-spans.test.ts` pins the absence of stage data in `RecentRunOut`. It fails on
purpose once a re-pin brings `stages` in. At that point, consume the field in a task PR and
supersede this record. The same test shows that an additive `stages` field is ignored by
`parseOpsSummary`.
