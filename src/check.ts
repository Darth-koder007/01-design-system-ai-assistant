import { analyzeFiles } from "./analyze.js";
import { generateCodemod } from "./codemod.js";
import type { ComponentRegistry } from "./component-registry.js";
import { explainViolation } from "./explain.js";
import type { LlmClient } from "./llm/types.js";
import type { Violation } from "./types.js";

export interface CheckedViolation extends Violation {
  explanation: string;
  codemodDiff?: string;
}

/**
 * Extracts the *target* component name from a violation message — the last `<...>` occurrence,
 * not the first. For raw-element-should-be-component ("Raw <input> should be <Input>..."), the
 * first match is the raw tag being replaced, not the design-system component; for deprecated-prop
 * ("<Button> prop ..."), there's only one match, so first-vs-last makes no difference there.
 */
export function extractTargetComponentName(violation: Violation): string {
  const matches = [...violation.message.matchAll(/<(\w+)>/g)];
  return matches.at(-1)?.[1] ?? "";
}

export async function checkFiles(
  paths: string[],
  componentRegistry: ComponentRegistry,
  llmClient: LlmClient
): Promise<CheckedViolation[]> {
  const violations = analyzeFiles(paths, { componentRegistry });

  const results: CheckedViolation[] = [];
  for (const violation of violations) {
    const componentInfo = componentRegistry.get(extractTargetComponentName(violation));
    const explanation = await explainViolation(violation, llmClient, componentInfo);
    const codemod = generateCodemod(violation.file, violation, componentRegistry);

    results.push({
      ...violation,
      explanation,
      ...(codemod?.typeChecks ? { codemodDiff: codemod.diff } : {}),
    });
  }
  return results;
}

export function formatText(results: CheckedViolation[]): string {
  if (results.length === 0) return "No violations found.";

  const lines: string[] = [];
  for (const result of results) {
    lines.push(`\n${result.file}:${result.line} [${result.severity}] ${result.ruleId}`);
    lines.push(`  ${result.message}`);
    lines.push(`  ${result.explanation}`);
    if (result.codemodDiff) lines.push(`\n${result.codemodDiff}`);
  }
  lines.push(`\n${results.length} violation(s) found.`);
  return lines.join("\n");
}
