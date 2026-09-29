import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkFiles, formatText } from "./check.js";
import { buildComponentRegistry } from "./component-registry.js";
import type { LlmClient } from "./llm/types.js";

function fixture(name: string): string {
  return fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
}

const fakeLlmClient: LlmClient = {
  generate: async (request) => ({
    text: `[stub explanation for: ${request.prompt.split("\n")[0]}]`,
    provider: "fake",
    model: "fake",
  }),
};

describe("checkFiles", () => {
  it("passes the TARGET component's props to explainViolation for raw-element violations, not the raw tag's (regression: extractTagName used to grab the first <...> match, the raw tag, not the last)", async () => {
    const registry = buildComponentRegistry();
    const capturedPrompts: string[] = [];
    const capturingClient: LlmClient = {
      generate: async (request) => {
        capturedPrompts.push(request.prompt);
        return { text: "stub", provider: "fake", model: "fake" };
      },
    };

    await checkFiles([fixture("raw-elements.tsx")], registry, capturingClient);

    const inputPrompt = capturedPrompts.find((p) => p.includes("should be <Input>"));
    expect(inputPrompt).toBeDefined();
    expect(inputPrompt).toContain("Input's available props:");
    expect(inputPrompt).toContain("- label");
  });

  it("attaches an explanation and a type-checking codemod diff to each violation", async () => {
    const registry = buildComponentRegistry();
    const results = await checkFiles([fixture("deprecated-prop.tsx")], registry, fakeLlmClient);

    expect(results).toHaveLength(1);
    expect(results[0]?.explanation).toContain("stub explanation");
    expect(results[0]?.codemodDiff).toContain('+      <Button tone="danger">Delete</Button>');
  });

  it("omits codemodDiff for violations with no mechanical fix or a failing one", async () => {
    const registry = buildComponentRegistry();
    const results = await checkFiles([fixture("hardcoded-values.tsx")], registry, fakeLlmClient);

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.codemodDiff === undefined)).toBe(true);
  });

  it("returns an empty array for a clean file", async () => {
    const registry = buildComponentRegistry();
    const results = await checkFiles([fixture("clean.tsx")], registry, fakeLlmClient);
    expect(results).toEqual([]);
  });
});

describe("formatText", () => {
  it("reports no violations found for an empty result set", () => {
    expect(formatText([])).toBe("No violations found.");
  });

  it("includes file, line, rule id, message, and explanation for each violation", () => {
    const output = formatText([
      {
        file: "src/Foo.tsx",
        line: 3,
        ruleId: "deprecated-prop",
        severity: "warning",
        message: "test message",
        matchedCode: 'color="danger"',
        explanation: "test explanation",
      },
    ]);

    expect(output).toContain("src/Foo.tsx:3");
    expect(output).toContain("deprecated-prop");
    expect(output).toContain("test message");
    expect(output).toContain("test explanation");
    expect(output).toContain("1 violation(s) found.");
  });
});
