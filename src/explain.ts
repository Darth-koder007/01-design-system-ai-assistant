import type { ComponentInfo } from "./component-registry.js";
import type { LlmClient } from "./llm/types.js";
import type { Violation } from "./types.js";

const EXPLAIN_TIMEOUT_MS = 10_000;

const SYSTEM_PROMPT = `You are a senior frontend engineer reviewing a pull request for design-system compliance.
Given a single violation and the target component's actual prop API, write a short, specific,
actionable explanation (2-4 sentences) of what to change and why. Reference real prop names from
the API given to you — never invent props that aren't listed. Do not restate the violation message
verbatim; add value beyond it (a concrete before/after, or a prop the author might not know about).`;

function formatPropList(componentInfo: ComponentInfo): string {
  return componentInfo.props
    .map((prop) => `- ${prop.name}${prop.deprecated ? " (deprecated)" : ""}`)
    .join("\n");
}

function buildPrompt(violation: Violation, componentInfo?: ComponentInfo): string {
  const lines = [
    `Rule: ${violation.ruleId}`,
    `Violation: ${violation.message}`,
    `Code: ${violation.matchedCode}`,
  ];

  if (componentInfo) {
    lines.push(`\n${componentInfo.name}'s available props:`, formatPropList(componentInfo));
  }

  return lines.join("\n");
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`LLM call exceeded ${ms}ms`)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * Never throws — falls back to the rule's own deterministic message if the LLM call fails
 * or times out, so a flaky/slow LLM never blocks the analysis pipeline.
 */
export async function explainViolation(
  violation: Violation,
  llmClient: LlmClient,
  componentInfo?: ComponentInfo
): Promise<string> {
  try {
    const result = await withTimeout(
      llmClient.generate({
        system: SYSTEM_PROMPT,
        prompt: buildPrompt(violation, componentInfo),
      }),
      EXPLAIN_TIMEOUT_MS
    );
    return result.text.trim();
  } catch {
    return violation.message;
  }
}
