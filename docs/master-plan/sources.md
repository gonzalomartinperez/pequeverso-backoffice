# Sources

Every external source used or relied on by this plan. The plan itself reads the research notes in `research/` (copied unchanged); the URLs below are the primary sources those notes cite for the points this plan depends on, plus the standards the ecosystem file names. Dates: research notes written 2026-11-09 (their own dates inside); this plan did not fetch web pages itself (repository facts were read with `git`; measurements come from the audit harness under `audit/`). Commercial-interest flag: **C** = vendor with a commercial interest in the topic, **N** = standards body, community or open-source project without a paid product at stake, **M** = mixed (open source with a commercial company behind it).

| Topic | Source | Where used | Date accessed (via note) | Flag |
|---|---|---|---|---|
| Next.js output standalone, headers, proxy | https://nextjs.org/docs/app/api-reference/config/next-config-js/output | `target-state.md`, `ci-cd.md` | 2026-11-09 (`research/01`) | M (Vercel) |
| Tailwind 4 theme variables | https://tailwindcss.com/docs/theme | `design-playbook.md` section 5 | 2026-11-09 (`research/01`) | M |
| Design Tokens Community Group format | https://www.w3.org/community/design-tokens/ | tokens as DTCG | 2026-11-09 (`research/06`) | N |
| WCAG 2.2 (2.4.11, 2.5.8, 1.4.10, 1.4.11, 3.2.6, 3.3.7, 3.3.8) | https://www.w3.org/TR/WCAG22/ | `design-playbook.md`, `testing.md` | 2026-11-09 (`research/06`) | N |
| Dashboard density and table patterns (Carbon data table) | referenced in `research/06` section 5 (practitioner and design-system docs, secondary) | `design-playbook.md` sections 6, 8 | 2026-11-09 | M (IBM) |
| Backoffice redesign foundation (authors' expertise, no fresh fetch) | `research/12-backoffice-redesign.md` | whole `design-playbook.md` | 2026-11-09 | N (internal) |
| Stryker incremental mode and runners | https://stryker-mutator.io/docs/stryker-js/incremental/ | `testing.md` | 2026-11-09 (`research/04`) | N |
| Playwright CLI, sharding, visual comparisons | https://playwright.dev/docs/test-cli | `testing.md`, `ci-cd.md` | 2026-11-09 (`research/04`) | M (Microsoft) |
| fast-check, property-based testing | referenced in `research/04` section 4 | `testing.md` | 2026-11-09 | N |
| better-auth advisories GHSA-wxw3-q3m9-c3jr and GHSA-9h47-pqcx-hjr4 and security guidance | cited in `research/04` section 12 (S45, S46) | `testing.md`, `dependencies.md` | 2026-11-09 | M (vendor of the library) |
| OWASP A01:2025 access control testing | cited in `research/04` section 12 (S47) | authz matrix | 2026-11-09 | N |
| GitHub Actions secure use, Dependabot options, release-please, artifact attestations | https://docs.github.com/en/actions/reference/security/secure-use ; https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference ; https://github.com/googleapis/release-please-action ; https://docs.github.com/en/actions/concepts/security/artifact-attestations | `ci-cd.md` | 2026-11-09 (`research/05`) | M (GitHub) |
| zizmor, OpenSSF Scorecard, SLSA | https://docs.zizmor.sh ; https://securityscorecards.dev ; https://slsa.dev/spec/v1.2 | `ci-cd.md` | 2026-11-09 (`research/05`) | N |
| Trivy March 2026 compromise (tag force-push) and safe version | https://github.com/aquasecurity/trivy/security/advisories/GHSA-69fq-xp46-6x23 | scanner choice (Grype) | 2026-11-09 (`research/11`) | M |
| Container LTS matrix (Node, Python, PostgreSQL, Debian) | https://raw.githubusercontent.com/nodejs/Release/main/schedule.json ; https://endoflife.date ; https://devguide.python.org/versions/ | `ci-cd.md` section 8 | 2026-11-09 (`research/11`) | N |
| Distroless images | https://github.com/GoogleContainerTools/distroless | app Dockerfile | 2026-11-09 (`research/11`) | M (Google) |
| Docker build attestations | https://docs.docker.com/build/ci/github-actions/attestations/ | `ci-cd.md` | 2026-11-09 (`research/11`) | M (Docker) |
| Dynamic CI, aggregate gate, reusable workflows | `research/11` sections 6.1 to 6.9 | `ci-cd.md` | 2026-11-09 | N |
| Google TypeScript Style Guide, Biome, TypeScript 7 announcement | https://google.github.io/styleguide/tsguide.html ; https://biomejs.dev ; https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ | `standards.md` | 2026-11-09 (`research/10`) | M |
| Dependency policy template (MADR 4) | `research/10` "Dependency policy template" | `dependencies.md` | 2026-11-09 | N |
| README, AGENTS.md, Agent Skills, MADR, Diataxis, Keep a Changelog | https://agentskills.io/specification ; https://adr.github.io/madr/ ; https://diataxis.fr ; https://keepachangelog.com | `docs-and-community.md`, `skills.md` | 2026-11-09 (`research/08`) | N (agentskills.io is an Anthropic-led spec: M) |
| VPS and Coolify risk, backups, SLOs, deploy contract | https://coolify.io/docs/knowledge-base/server/firewall ; https://docs.docker.com/engine/network/packet-filtering-firewalls/ ; https://sre.google/workbook/alerting-on-slos/ | MV section, deployment contract | 2026-11-09 (`research/09`) | M (Coolify, Docker), N (Google SRE) |
| Claude Code harness (memory, settings, hooks, agents, skills, marketplace, MCP, worktrees) | code.claude.com/docs as summarised in `research/15-claude-code-harness.md` | `skills.md` section 5 | 2026-11-09 | C (Anthropic) |
| Codex harness (AGENTS.md, config, skills, hooks, code review, action) | developers.openai.com/codex (now learn.chatgpt.com/docs) as summarised in `research/14-codex-harness.md` | `skills.md` section 5 | 2026-11-09 | C (OpenAI) |
| Repository facts (files, ADRs, workflows, contracts, tests) | `git show origin/develop:<path>` at 4d4fb96 | all files | 2026-11-09 | n/a (primary) |
| Measurements | `audit/` (harness run on origin/develop 4d4fb96) | `audit.md`, `scorecard.md` | 2026-11-09 | n/a (primary) |
| Standards and decisions | `ecosystem.md`, `rubrics.md`, `owner-decisions.md` (owner decisions), `shared/dependabot-rule.md` | everywhere | 2026-11-09 | n/a (owner) |

Unverified items (carried from the notes and from this plan): Dependabot multi-ecosystem group behaviour (four points, E2); private-repo and user-namespace availability of CodeQL, merge queue and attestations (the repo is public, so the plan assumes free CodeQL, Scorecard and attestations; private GHCR package attestation verification is unproven); Stryker `tap-runner` with TypeScript 7 (spike S1); Next.js 16.4 and native dependencies on Node 26; Style Dictionary v5 versus Terrazzo output equivalence (M5.1 spike); per-route JavaScript size from Next 16 build manifests (M2.8 spike); licence of the chosen handwriting font (checked at selection); health of the proposed new dev tools (checked in each dependency ADR).
