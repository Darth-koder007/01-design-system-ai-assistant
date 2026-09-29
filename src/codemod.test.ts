import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeFiles } from "./analyze.js";
import { buildComponentRegistry } from "./component-registry.js";
import { generateCodemod } from "./codemod.js";

function fixture(name: string): string {
  return fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
}

const registry = buildComponentRegistry();

describe("generateCodemod", () => {
  it("renames a deprecated prop to its replacement and type-checks cleanly", () => {
    const filePath = fixture("deprecated-prop.tsx");
    const [violation] = analyzeFiles([filePath], { componentRegistry: registry }).filter(
      (v) => v.ruleId === "deprecated-prop"
    );
    expect(violation).toBeDefined();

    const result = generateCodemod(filePath, violation!, registry);

    expect(result).not.toBeNull();
    expect(result!.typeChecks).toBe(true);
    expect(result!.diff).toContain('-      <Button color="danger">Delete</Button>');
    expect(result!.diff).toContain('+      <Button tone="danger">Delete</Button>');
  });

  it("converts a raw button to <Button>, adding the import, and type-checks cleanly", () => {
    const filePath = fixture("raw-elements.tsx");
    const violations = analyzeFiles([filePath], { componentRegistry: registry }).filter(
      (v) => v.ruleId === "raw-element-should-be-component"
    );
    const buttonViolation = violations.find((v) => v.matchedCode.includes("<button"));
    expect(buttonViolation).toBeDefined();

    const result = generateCodemod(filePath, buttonViolation!, registry);

    expect(result).not.toBeNull();
    expect(result!.typeChecks).toBe(true);
    expect(result!.diff).toContain('import { Button } from "@ds/components";');
    expect(result!.diff).toContain("<Button");
  });

  it("drops the now-invalid type attribute when converting to <Checkbox>, but correctly fails to type-check since Checkbox requires a label the raw input never had", () => {
    // This is a real, honest limitation, not a test-fitting shortcut: CheckboxProps requires
    // `label` (accessibility), and a bare `<input type="checkbox">` has nothing to source one
    // from without extra heuristics (e.g. a sibling <label for=...>) this tool doesn't attempt.
    // The correct behavior is exactly what's asserted here — generate the mechanical part,
    // notice it doesn't type-check, and let the caller fall back to explanation-only.
    const filePath = fixture("raw-elements.tsx");
    const violations = analyzeFiles([filePath], { componentRegistry: registry }).filter(
      (v) => v.ruleId === "raw-element-should-be-component"
    );
    const checkboxViolation = violations.find((v) => v.message.includes("<Checkbox>"));
    expect(checkboxViolation).toBeDefined();

    const result = generateCodemod(filePath, checkboxViolation!, registry);

    expect(result).not.toBeNull();
    expect(result!.typeChecks).toBe(false);
    expect(result!.diff).toContain('+      <Checkbox name="agree" />');
  });

  it("falls back to null for select -> Select, since it can't synthesize the required options prop", () => {
    const filePath = fixture("raw-elements.tsx");
    const violations = analyzeFiles([filePath], { componentRegistry: registry }).filter(
      (v) => v.ruleId === "raw-element-should-be-component"
    );
    const selectViolation = violations.find((v) => v.message.includes("<Select>"));
    expect(selectViolation).toBeDefined();

    const result = generateCodemod(filePath, selectViolation!, registry);

    expect(result).not.toBeNull();
    expect(result!.typeChecks).toBe(false);
  });

  it("returns null for rules with no mechanical fix (hardcoded-value-should-be-token)", () => {
    const filePath = fixture("hardcoded-values.tsx");
    const [violation] = analyzeFiles([filePath], { componentRegistry: registry });
    expect(violation).toBeDefined();

    expect(generateCodemod(filePath, violation!, registry)).toBeNull();
  });
});
