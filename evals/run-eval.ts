import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeFiles } from "../src/analyze.js";
import { generateCodemod } from "../src/codemod.js";
import { buildComponentRegistry, type ComponentInfo } from "../src/component-registry.js";
import { extractTargetComponentName } from "../src/check.js";
import { explainViolation } from "../src/explain.js";
import { createLlmClient } from "../src/llm/create-client.js";
import type { Violation } from "../src/types.js";

const MECHANICAL_RULE_IDS = new Set(["raw-element-should-be-component", "deprecated-prop"]);

// Every component's Props interface extends some native *HTMLAttributes type and forwards the
// rest via {...rest} — so native attribute names are always legitimately usable even though
// component-registry.ts only walks each interface's OWN declared properties. Also allow the raw
// HTML tag names models sometimes reference in backticks when discussing the element being
// replaced. (See M1.8's first eval run: without this list, the scorer flagged the model correctly
// mentioning e.g. `checked` or `onClick` as a "hallucination", when it wasn't one — a real flaw in
// the eval's own scoring, not the LLM.)
const ALWAYS_VALID_MENTIONS = new Set([
  "id",
  "name",
  "value",
  "type",
  "checked",
  "disabled",
  "required",
  "readOnly",
  "placeholder",
  "className",
  "style",
  "children",
  "onClick",
  "onChange",
  "onFocus",
  "onBlur",
  "onSubmit",
  "key",
  "defaultValue",
  "defaultChecked",
  "htmlFor",
  "input",
  "button",
  "select",
]);

interface CaseResult {
  violation: Violation;
  explanation: string;
  explanationPassed: boolean;
  hallucinatedProps: string[];
  codemodAttempted: boolean;
  codemodSucceeded: boolean;
}

function findHallucinatedProps(explanation: string, componentInfo?: ComponentInfo): string[] {
  if (!componentInfo) return [];

  const validNames = new Set([
    ...componentInfo.props.map((p) => p.name),
    componentInfo.name,
    ...ALWAYS_VALID_MENTIONS,
  ]);
  const mentioned = [...explanation.matchAll(/`(\w+)`/g)].map((m) => m[1]);

  return [...new Set(mentioned)].filter(
    (name): name is string => name !== undefined && !validNames.has(name)
  );
}

async function evaluateCase(
  filePath: string,
  registry: ReturnType<typeof buildComponentRegistry>,
  llmClient: ReturnType<typeof createLlmClient>
): Promise<CaseResult[]> {
  const violations = analyzeFiles([filePath], { componentRegistry: registry });
  const results: CaseResult[] = [];

  for (const violation of violations) {
    const componentInfo = registry.get(extractTargetComponentName(violation));
    const explanation = await explainViolation(violation, llmClient, componentInfo);
    const hallucinatedProps = findHallucinatedProps(explanation, componentInfo);
    const explanationPassed = explanation.length > 20 && hallucinatedProps.length === 0;

    const mechanical = MECHANICAL_RULE_IDS.has(violation.ruleId);
    const codemod = mechanical ? generateCodemod(violation.file, violation, registry) : null;

    results.push({
      violation,
      explanation,
      explanationPassed,
      hallucinatedProps,
      codemodAttempted: mechanical,
      codemodSucceeded: Boolean(codemod?.typeChecks),
    });
  }

  return results;
}

async function main() {
  const casesDir = fileURLToPath(new URL("./cases", import.meta.url));
  const caseFiles = readdirSync(casesDir)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => join(casesDir, f));

  const registry = buildComponentRegistry();
  const llmClient = createLlmClient();
  const providerModel = `${process.env.LLM_PROVIDER ?? "ollama"}:${process.env.LLM_MODEL ?? "(default)"}`;

  const allResults: CaseResult[] = [];
  for (const filePath of caseFiles) {
    allResults.push(...(await evaluateCase(filePath, registry, llmClient)));
  }

  const explanationEligible = allResults.length;
  const explanationPassed = allResults.filter((r) => r.explanationPassed).length;
  const explanationQualityRate = explanationEligible ? explanationPassed / explanationEligible : 1;

  const mechanicalResults = allResults.filter((r) => r.codemodAttempted);
  const codemodSucceeded = mechanicalResults.filter((r) => r.codemodSucceeded).length;
  const codemodSuccessRate = mechanicalResults.length
    ? codemodSucceeded / mechanicalResults.length
    : 1;

  const summary = {
    date: process.env.EVAL_DATE ?? new Date(0).toISOString().slice(0, 10),
    providerModel,
    caseFileCount: caseFiles.length,
    totalViolations: allResults.length,
    explanationQualityRate: Number(explanationQualityRate.toFixed(3)),
    codemodEligibleCount: mechanicalResults.length,
    codemodSuccessRate: Number(codemodSuccessRate.toFixed(3)),
  };

  const hallucinations = allResults.filter((r) => r.hallucinatedProps.length > 0);

  const isCheckMode = process.argv.includes("--check");
  const baselinePath = fileURLToPath(new URL("./baseline.json", import.meta.url));

  if (isCheckMode) {
    const previous = JSON.parse(readFileSync(baselinePath, "utf8"));
    console.log(JSON.stringify(summary, null, 2));

    // The local Ollama model samples non-deterministically — re-running the exact same 22 cases
    // against the exact same model produced 70.8% / 91.7% / 87.5% explanation-quality readings in
    // a row while iterating on this script (see PLAN.md M1.8). A zero-tolerance "any decrease
    // fails" gate would make CI flaky on pure sampling noise, not real regressions. A double-digit
    // drop is still a real signal; this tolerance exists to absorb noise, not to hide it.
    const REGRESSION_TOLERANCE = 0.1;
    const explanationDrop = previous.explanationQualityRate - summary.explanationQualityRate;
    const codemodDrop = previous.codemodSuccessRate - summary.codemodSuccessRate;

    if (explanationDrop > REGRESSION_TOLERANCE || codemodDrop > REGRESSION_TOLERANCE) {
      console.error(
        `Eval scores regressed beyond the ${REGRESSION_TOLERANCE * 100}% noise tolerance: explanation ${previous.explanationQualityRate} -> ${summary.explanationQualityRate}, codemod ${previous.codemodSuccessRate} -> ${summary.codemodSuccessRate}`
      );
      process.exit(1);
    }
    return;
  }

  writeFileSync(baselinePath, JSON.stringify(summary, null, 2) + "\n");

  const lines = [
    "# Eval results",
    "",
    "Regenerated by `evals/run-eval.ts` — do not hand-edit. Run `pnpm eval` to reproduce, `pnpm eval:update` to accept new numbers.",
    "",
    `- **Date:** ${summary.date}`,
    `- **Provider/model:** ${summary.providerModel}`,
    `- **Case files:** ${summary.caseFileCount} (original, hand-written — see PLAN.md M1.8 for why not scraped from real repos)`,
    `- **Total violations found across the eval set:** ${summary.totalViolations}`,
    "",
    "## Explanation quality",
    "",
    `**${(summary.explanationQualityRate * 100).toFixed(1)}%** (${explanationPassed}/${explanationEligible}) — non-degenerate output, and (where a target component is known) references only props that actually exist on it.`,
    "",
    hallucinations.length > 0
      ? `${hallucinations.length} case(s) with a hallucinated prop name:\n${hallucinations
          .map(
            (h) =>
              `- \`${h.violation.file.split("/").pop()}:${h.violation.line}\` invented: ${h.hallucinatedProps.join(", ")}`
          )
          .join("\n")}`
      : "No hallucinated props detected in this run.",
    "",
    "## Codemod success rate",
    "",
    `**${(summary.codemodSuccessRate * 100).toFixed(1)}%** (${codemodSucceeded}/${summary.codemodEligibleCount}) of mechanical-fix-eligible violations (\`raw-element-should-be-component\`, \`deprecated-prop\`) produced a diff that type-checks.`,
    "",
    "Not 100%, deliberately — see M1.5 in PLAN.md. `Checkbox`/`Radio` conversions from a bare `<input>` with no adjacent label, and `select` -> `Select` without an `options` prop, cannot be safely mechanized and correctly fall back to explanation-only instead of producing broken code.",
  ];

  writeFileSync(fileURLToPath(new URL("./results.md", import.meta.url)), lines.join("\n") + "\n");

  console.log(JSON.stringify(summary, null, 2));
}

main();
