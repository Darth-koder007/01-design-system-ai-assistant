import { describe, expect, it, vi } from "vitest";
import type { ComponentInfo } from "./component-registry.js";
import { explainViolation } from "./explain.js";
import type { LlmClient } from "./llm/types.js";
import type { Violation } from "./types.js";

const violation: Violation = {
  file: "src/DeleteAction.tsx",
  line: 6,
  ruleId: "deprecated-prop",
  severity: "warning",
  message: '<Button> prop "color" is deprecated. Use `tone` instead.',
  matchedCode: 'color="danger"',
};

const buttonInfo: ComponentInfo = {
  name: "Button",
  props: [
    { name: "size", deprecated: false },
    { name: "tone", deprecated: false },
    { name: "color", deprecated: true, deprecationMessage: "Use `tone` instead." },
  ],
};

describe("explainViolation", () => {
  it("returns the LLM's trimmed explanation on success", async () => {
    const llmClient: LlmClient = {
      generate: vi.fn().mockResolvedValue({
        text: "  Replace color with tone.  ",
        provider: "fake",
        model: "fake",
      }),
    };

    const explanation = await explainViolation(violation, llmClient, buttonInfo);
    expect(explanation).toBe("Replace color with tone.");
  });

  it("passes the component's real prop list into the prompt, not an invented one", async () => {
    const generate = vi.fn().mockResolvedValue({ text: "ok", provider: "fake", model: "fake" });
    await explainViolation(violation, { generate }, buttonInfo);

    const promptArg = generate.mock.calls[0]?.[0]?.prompt as string;
    expect(promptArg).toContain("tone");
    expect(promptArg).toContain("color (deprecated)");
  });

  it("falls back to the rule's deterministic message if the LLM call throws", async () => {
    const llmClient: LlmClient = { generate: vi.fn().mockRejectedValue(new Error("network down")) };

    const explanation = await explainViolation(violation, llmClient, buttonInfo);
    expect(explanation).toBe(violation.message);
  });

  it("falls back to the deterministic message if the LLM call hangs past the timeout", async () => {
    vi.useFakeTimers();
    const llmClient: LlmClient = { generate: () => new Promise(() => {}) };

    const explanationPromise = explainViolation(violation, llmClient, buttonInfo);
    await vi.advanceTimersByTimeAsync(10_001);

    await expect(explanationPromise).resolves.toBe(violation.message);
    vi.useRealTimers();
  });
});
