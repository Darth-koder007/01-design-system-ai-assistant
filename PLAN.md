# Project 1 — Design-System AI Assistant

## Purpose

The flagship project. Static analysis (your existing strength from the Delivery Hero metrics dashboard) extended with an LLM layer: detect design-system violations in a diff, explain them in natural language, and propose a reviewable autofix. Runs against Project 0's design system.

## Tech decisions

- **Static analysis:** TypeScript Compiler API (`ts-morph` as an ergonomic wrapper) — same tool family as your metrics-dashboard experience, directly reusable framing for interviews.
- **LLM:** provider-agnostic client (see M1.3). Ollama is the default for local development — no API key, no per-request cost, nothing blocking iteration. Anthropic is the optional higher-quality provider, used for the numbers published in the README. Used only where a rule can't be — see M1.2 vs M1.4 split below. Don't reach for the LLM for what a deterministic rule already solves; that restraint is itself a signal of judgment.
- **Delivery:** CLI first (works standalone, easiest to demo/record), GitHub Action second (wraps the CLI, posts PR comments).
- **Cross-repo dependency:** this repo depends on Project 0's packages via `link:../00-design-system/packages/...` (a local workspace link), not a real npm dependency, since Project 0 isn't published to a registry yet. CI reproduces this by checking out both repos as sibling directories. Once Project 0 publishes (M0.7's remaining registry-publish step, itself blocked on npm/GitHub account access), this becomes a normal semver `"@ds/components": "^0.1.x"` dependency and the two-checkout CI step goes away — tracked here as a known, deliberate interim state, not an oversight.

## Milestones

### M1.1 — Static-analysis layer — done

- [x] Parse a target file/diff into an AST, walk JSX for element usage (`jsx-utils.ts`, `analyze.ts`)
- [x] Detect: raw HTML elements matching a design-system component's semantic role, hardcoded style values matching a token's value, deprecated prop usage
- [x] Output a structured `Violation[]` (file, line, rule id, severity, message, matched code) — no LLM involved
- **Acceptance:** verified — 7 fixture-based tests in `src/analyze.test.ts`, each asserting the exact violation list (not just "some violations exist").

### M1.2 — Rule engine — done

- [x] Rules are data returned by factory functions implementing a shared `Rule` interface (`rule-registry.ts`), not hardcoded in the walker
- [x] 4 rule categories (one more than the minimum 3): `raw-element-should-be-component`, `hardcoded-value-should-be-token`, `deprecated-prop`, `hardcoded-svg-color`
- [x] Config (`RuleConfig`) lets a consumer enable/disable rules and override severity per rule ID
- **Acceptance:** verified for real, not just asserted — added `hardcoded-svg-color` (the 4th rule) after M1.1/M1.2's core three were already working, and it required exactly one new file plus one line in `buildAllRules`'s array; zero changes to `jsx-utils.ts`, `analyze.ts`, or `types.ts`. Component-prop metadata (including `@deprecated` JSDoc) is read directly from Project 0's actual `.tsx` source via `component-registry.ts`, not hand-maintained — verified empirically against the real `Button.tsx` before writing the rules that depend on it, which is what caught two real bugs upstream (see Project 0's changelog: the missing `"./package.json"` export, discovered because this registry builder needs it to locate the source directory).

### M1.3 — LLM client abstraction — done

- [x] A single interface (`LlmClient.generate(request) -> GenerateResult`) with two implementations: Ollama (local, default) and Anthropic (optional, config-selected via `LLM_PROVIDER`)
- [x] Prompts are provider-neutral (`{ prompt, system }`) — nothing assumed that only one provider supports
- [x] Model choice per provider is config (`LLM_MODEL` env or explicit option), defaulting to `llama3.2:3b` for Ollama (see M1.4 — the initial `1b` default was replaced after a real hallucination finding) and `claude-haiku-4-5-20251001` for Anthropic — not hardcoded elsewhere
- [x] Ollama runs via Docker (`docker-compose.yml`) on host port **11435**, not the default 11434 — a real conflict I hit immediately: this machine already has a native Ollama install bound to 11434 with its own models, so the Dockerized instance needs its own port to stay unambiguous and portable for anyone else running this
- **Acceptance:** verified live, not just structurally — `docker compose up -d`, pulled `llama3.2:1b` (1.3GB, ~1 min), called `createLlmClient().generate(...)` with zero env config and got a real completion back from the container. Anthropic path is verified by construction + a unit test (throws a clear error with no key, constructs cleanly with one) — a live call needs a real API key, deferred to M1.8 where one gets used deliberately for the published eval baseline, matching the plan's own reasoning for why that's the only place a key should be needed.

### M1.4 — LLM layer: explanation — done

- [x] Given a `Violation` + the target component's real prop list (from `component-registry.ts`), generates a specific explanation via `explainViolation()` — not a generic "use the design system" message
- [x] Prompt includes the actual component API and explicitly instructs the model not to invent props outside it
- [x] Deterministic fallback (the rule's own `violation.message`) on any LLM error or a 10s timeout — verified with both a rejected-promise test and a fake-timers hung-promise test
- **Acceptance:** verified live against real Ollama, and the process caught a real quality problem worth recording honestly: the initial default model (`llama3.2:1b`) passed the substring check ("tone" present) but **hallucinated a nonexistent `success` prop** in its explanation — not caught by a crude substring assertion, only by actually reading the output. Switched the default to `llama3.2:3b` (~2GB, still small), re-verified live, no hallucination, concrete before/after code (`tone="danger"` instead of `color="danger"`). This is exactly the gap M1.8's eval harness needs to score for explicitly (does the explanation reference only real props), not just presence of the right keyword — noted here as a design input for M1.8, not deferred silently.

### M1.5 — Codemod generation — done

- [x] Deterministic AST-based transforms via ts-morph (`codemod.ts`) — no LLM involved, since the mechanical fix is already fully determined once a rule fires (rename a tag, rename a prop); renames both the opening and closing JSX tag, adds/extends the `@ds/components` import as needed
- [x] Output is a unified diff (`diff` package's `createPatch`), computed on an in-memory ts-morph `Project` — the real file on disk is never touched
- [x] Transform is type-checked (`getPreEmitDiagnostics()` against a `Project` built from this repo's real `tsconfig.json`, so `@ds/components`'s actual types are in scope) before being presented; `typeChecks: false` signals the caller to fall back to explanation-only
- **Acceptance:** verified against real fixtures, including two cases that are _supposed_ to fail and correctly do: `select` → `Select` fails type-check because `Select` requires an `options` prop this tool can't safely synthesize from raw `<option>` children, and `input[type=checkbox]` → `Checkbox` fails because `CheckboxProps` requires a `label` (accessibility) that a bare checkbox input has no source for. Both are genuine limitations, not bugs — the fallback path is what makes them safe. `Button`'s deprecated `color` → `tone` rename and raw `<button>` → `<Button>` both succeed and type-check cleanly. 5 tests in `codemod.test.ts`.

### M1.6 — CLI + GitHub Action — CLI verified live; Action written, unverified (needs a pushed repo)

- [x] `assistant check <paths...>` — human-readable terminal output with file:line, message, explanation, suggested diff (`cli.ts`/`check.ts`, logic split out of the entry point so it's testable — a bare `program.parse()` at module scope would otherwise fire on import)
- [x] `assistant check --format=json` for machine consumption
- [x] GitHub Action (`design-system-check.yml`) wraps the built CLI, runs on `pull_request` with Ollama as a service container (no API key/secret needed), posts one inline review comment per violation via `actions/github-script`
- [ ] **Not yet verified end-to-end:** doing so needs an actual PR against a pushed GitHub repo, which needs the same GitHub account access blocked since M0.5. The CLI itself (the part that matters most) _is_ verified live — see below.
- **Acceptance (CLI):** ran the real built CLI (`node dist/cli.js check ...`) against both fixtures live against Ollama. `deprecated-prop.tsx`: correct explanation, correct codemod diff. `raw-elements.tsx` (5 violations): 2 get a clean codemod diff (`Input`, `Button` — both type-check), 3 correctly omit one (`Checkbox`, `Radio`, `Select` — all fail their type-check gate for the genuine reasons documented in M1.5), and every single violation still gets a real, useful LLM explanation regardless. This is the whole pipeline working end to end, not a mocked demo.

### M1.7 — Fixture-based test suite

- [ ] One fixture file per rule: input + expected `Violation[]`
- [ ] Golden-file tests for codemod output (input + rule → expected diff)
- [ ] LLM-dependent tests use substring/structural assertions, run against a recorded/replayed response in CI (no live calls to either provider in CI — flaky and unnecessary)
- **Acceptance:** CI runs the full suite with zero live LLM calls and passes deterministically.

### M1.8 — Eval harness

- [ ] Pull 20-30 real violation cases from actual open-source repos using similar patterns (not the same clean fixtures from M1.7) — realistic messy code, ambiguous cases included
- [ ] Score two things separately: explanation quality (does it correctly name the replacement component and a relevant prop **and only reference props that actually exist on that component** — a real failure mode found in M1.4's manual testing, not hypothetical — scored by rubric or LLM-as-judge, not just substring match) and codemod success rate (does the generated diff type-check + pass tests, same bar as M1.5's acceptance, measured across the whole eval set not one fixture)
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
