import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeFiles } from "./analyze.js";

function fixture(name: string): string {
  return fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
}

describe("analyzeFiles", () => {
  it("returns no violations for a fixture that only uses design-system components correctly", () => {
    const violations = analyzeFiles([fixture("clean.tsx")]);
    expect(violations).toEqual([]);
  });

  it("detects raw HTML elements that duplicate a design-system component's role", () => {
    const violations = analyzeFiles([fixture("raw-elements.tsx")]);
    const byRule = violations.filter((v) => v.ruleId === "raw-element-should-be-component");

    expect(byRule.map((v) => v.message)).toEqual([
      "Raw <input> should be <Input> from the design system.",
      "Raw <input> should be <Checkbox> from the design system.",
      "Raw <input> should be <Radio> from the design system.",
      "Raw <select> should be <Select> from the design system.",
      "Raw <button> should be <Button> from the design system.",
    ]);
    expect(byRule.every((v) => v.severity === "warning")).toBe(true);
  });

  it("detects inline style values that duplicate an exact token color", () => {
    const violations = analyzeFiles([fixture("hardcoded-values.tsx")]);
    const byRule = violations.filter((v) => v.ruleId === "hardcoded-value-should-be-token");

    expect(byRule).toHaveLength(2);
    expect(byRule[0]?.message).toContain("color.blue.500");
    expect(byRule[1]?.message).toContain("color.gray.900");
  });

  it("detects usage of a deprecated design-system prop, but not the non-deprecated one", () => {
    const violations = analyzeFiles([fixture("deprecated-prop.tsx")]);
    const byRule = violations.filter((v) => v.ruleId === "deprecated-prop");

    expect(byRule).toHaveLength(1);
    expect(byRule[0]?.message).toContain('prop "color" is deprecated');
    expect(byRule[0]?.message).toContain("Use `tone` instead");
  });

  it("detects a hardcoded SVG fill/stroke color matching a token, but not currentColor", () => {
    const violations = analyzeFiles([fixture("hardcoded-svg-color.tsx")]);
    const byRule = violations.filter((v) => v.ruleId === "hardcoded-svg-color");

    expect(byRule).toHaveLength(1);
    expect(byRule[0]?.message).toContain('fill="#e59a1c"');
  });

  it("respects rule config: disabling a rule removes its violations", () => {
    const violations = analyzeFiles([fixture("raw-elements.tsx")], {
      config: { "raw-element-should-be-component": { enabled: false } },
    });

    expect(violations.filter((v) => v.ruleId === "raw-element-should-be-component")).toHaveLength(
      0
    );
  });

  it("respects rule config: severity override applies to all of that rule's violations", () => {
    const violations = analyzeFiles([fixture("hardcoded-values.tsx")], {
      config: { "hardcoded-value-should-be-token": { severity: "error" } },
    });

    const byRule = violations.filter((v) => v.ruleId === "hardcoded-value-should-be-token");
    expect(byRule.every((v) => v.severity === "error")).toBe(true);
  });
});
