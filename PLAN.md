# Project 1 — Design-System AI Assistant

## Purpose

The flagship project. Static analysis (your existing strength from the Delivery Hero metrics dashboard) extended with an LLM layer: detect design-system violations in a diff, explain them in natural language, and propose a reviewable autofix. Runs against Project 0's design system.

## Tech decisions

- **Static analysis:** TypeScript Compiler API (`ts-morph` as an ergonomic wrapper) — same tool family as your metrics-dashboard experience, directly reusable framing for interviews.
- **LLM:** provider-agnostic client (see M1.3). Ollama is the default for local development — no API key, no per-request cost, nothing blocking iteration. Anthropic is the optional higher-quality provider, used for the numbers published in the README. Used only where a rule can't be — see M1.2 vs M1.4 split below. Don't reach for the LLM for what a deterministic rule already solves; that restraint is itself a signal of judgment.
- **Delivery:** CLI first (works standalone, easiest to demo/record), GitHub Action second (wraps the CLI, posts PR comments).
- **Cross-repo dependency:** this repo depends on Project 0's packages via `link:../00-design-system/packages/...` (a local workspace link), not a real npm dependency, since Project 0 isn't published to a registry yet. CI reproduces this by checking out both repos as sibling directories. Once Project 0 publishes (M0.7's remaining registry-publish step, itself blocked on npm/GitHub account access), this becomes a normal semver `"@ds/components": "^0.1.x"` dependency and the two-checkout CI step goes away — tracked here as a known, deliberate interim state, not an oversight.

## Milestones

### M1.1 — Static-analysis layer

- [ ] Parse a target file/diff into an AST, walk JSX for element usage
- [ ] Detect: raw HTML elements matching a design-system component's semantic role (`<button>` where `<Button>` exists), hardcoded style values matching a token's value, deprecated prop usage
- [ ] Output a structured `Violation[]` (file, line, rule id, matched code) — no LLM involved yet
- **Acceptance:** running against a fixture file with known violations returns exactly the expected list, byte-for-byte reproducible.

### M1.2 — Rule engine

- [ ] Rules are data (id, description, matcher function, severity), not hardcoded in the walker — new rules addable without touching the traversal code
- [ ] At least 3 rule categories: deprecated prop, raw-element-should-be-component, hardcoded-value-should-be-token
- [ ] Config file lets a consuming repo enable/disable rules and set severity
- **Acceptance:** adding a 4th rule (your choice) requires only a new rule definition, no changes to M1.1's walker.

### M1.3 — LLM client abstraction

- [ ] A single interface (`generate(prompt, schema?) -> result`) with two implementations: Ollama (local, default) and Anthropic (optional, config-selected via an env var such as `LLM_PROVIDER`)
- [ ] Prompts are written provider-neutral — no formatting or feature assumed that only one provider supports
- [ ] Model choice per provider is config, not hardcoded (e.g. `llama3.1` or `qwen2.5-coder` locally, `claude-*` for the Anthropic path)
- [ ] Ollama runs via Docker locally (see repo-root `docker-compose.yml`) so `docker compose up` plus a model pull is the entire local setup — no native Ollama install required, though either works
- **Acceptance:** the same CLI command produces a result against both providers with only the env var changed; switching providers requires no code change.

### M1.4 — LLM layer: explanation

- [ ] Given a `Violation` + the design system's component prop types (from Project 0's exported types), generate a specific, actionable natural-language explanation and suggested replacement code
- [ ] Prompt includes the actual component API (not a general "use a design system" instruction) — this is what makes it more than a wrapper around a linter
- [ ] Deterministic fallback message if the LLM call fails or times out — never block the pipeline on the LLM
- **Acceptance:** for a fixture violation, the explanation correctly names the replacement component and at least one relevant prop, verified against a fixed expected substring (not exact-match, since LLM output varies) — checked against both providers.

### M1.5 — Codemod generation

- [ ] For violations with a mechanical fix (raw element → component, deprecated prop → new prop), generate an AST-based transform, not a text-based find/replace
- [ ] Output a unified diff, never write to disk directly — human always reviews before applying
- [ ] Transform is type-checked against the design system's types before being presented as a suggestion; discard and fall back to explanation-only if it doesn't type-check
- **Acceptance:** applying the generated diff to the fixture file produces code that compiles and passes the fixture's existing tests.

### M1.6 — CLI + GitHub Action

- [ ] `assistant check <path-or-diff>` — human-readable terminal output with file:line, explanation, suggested diff
- [ ] `assistant check --format=json` for machine consumption
- [ ] GitHub Action wraps the CLI, runs on `pull_request`, posts findings as inline PR review comments (not one giant comment). The Action's CI job runs against the Ollama container (M1.3), not Anthropic — no API secret needed for the workflow to run on a fork or in a public repo
- **Acceptance:** a real PR against a scratch repo using Project 0's design system gets correct inline comments from the Action.

### M1.7 — Fixture-based test suite

- [ ] One fixture file per rule: input + expected `Violation[]`
- [ ] Golden-file tests for codemod output (input + rule → expected diff)
- [ ] LLM-dependent tests use substring/structural assertions, run against a recorded/replayed response in CI (no live calls to either provider in CI — flaky and unnecessary)
- **Acceptance:** CI runs the full suite with zero live LLM calls and passes deterministically.

### M1.8 — Eval harness

- [ ] Pull 20-30 real violation cases from actual open-source repos using similar patterns (not the same clean fixtures from M1.7) — realistic messy code, ambiguous cases included
- [ ] Score two things separately: explanation quality (does it correctly name the replacement component and a relevant prop — scored by rubric or LLM-as-judge, not just substring match) and codemod success rate (does the generated diff type-check + pass tests, same bar as M1.5's acceptance, measured across the whole eval set not one fixture)
- [ ] Run the eval against Ollama for routine iteration; record the published baseline against Anthropic, and note which provider/model produced each number in `evals/results.md`
- [ ] Track both numbers in a checked-in `evals/results.md`, regenerated by a script, not hand-edited
- [ ] CI gate: a PR that drops either score below its last-recorded baseline fails (CI runs this against Ollama for cost/secret reasons; a manual script re-runs against Anthropic before publishing an updated baseline)
- **Acceptance:** running the eval script against the current codebase reproduces the numbers in `evals/results.md` exactly, for the provider recorded alongside each number.

### M1.9 — README + demo

- [ ] Problem framing: this is what the Delivery Hero metrics-dashboard experience generalizes to when you add an LLM layer — name that connection explicitly, it's your strongest credibility signal
- [ ] Architecture diagram: file/diff → AST → rule engine → (LLM explain + codemod) → CLI/Action output
- [ ] Recorded demo: real PR, real inline comments, <90 seconds
- [ ] State the M1.8 eval numbers up front, not buried, with the provider they were measured against
- [ ] "Design decisions" section: why rules stay deterministic and the LLM is scoped to explanation/codemod only, why codemods are never auto-applied, why the tool works with no API key via Ollama

### M1.10 — Flip repo to public

- [ ] Public, linked from `projects/04-portfolio-site`

## Testing strategy (summary)

Everything upstream of the LLM call (M1.1, M1.2) is fully deterministic and tested exactly. The LLM boundary (M1.4, M1.5) has two layers: fixture tests (M1.7, recorded responses in CI, exact/structural assertions — did it not break) and an eval harness (M1.8, real messy cases, scored not pass/fail — how good is it, and is it getting better or worse). This split is the answer to both "how did you test something that calls an LLM" and "how do you know the LLM output is actually good" in an interview. The provider abstraction (M1.3) is what lets all of this run without an API key or cost during normal iteration.
