import { color } from "@ds/tokens";
import { getAttribute, getJsxTagLikeElements, getLineNumber } from "../jsx-utils.js";
import { Node } from "ts-morph";
import type { Rule, RuleContext, Violation } from "../types.js";

const SVG_COLOR_ATTRIBUTES = ["fill", "stroke"];

function buildTokenColorValues(): Set<string> {
  const values = new Set<string>();
  for (const steps of Object.values(color)) {
    for (const value of Object.values(steps)) {
      values.add(value.toLowerCase());
    }
  }
  return values;
}

export function createHardcodedSvgColorRule(): Rule {
  const tokenColorValues = buildTokenColorValues();

  return {
    id: "hardcoded-svg-color",
    description:
      "Flags SVG fill/stroke attributes hardcoded to a token color instead of currentColor (the Icon component's own convention).",
    defaultSeverity: "warning",
    check(context: RuleContext): Violation[] {
      const { sourceFile, filePath } = context;
      const violations: Violation[] = [];

      for (const element of getJsxTagLikeElements(sourceFile)) {
        for (const attrName of SVG_COLOR_ATTRIBUTES) {
          const attr = getAttribute(element, attrName);
          if (!attr) continue;

          const initializer = attr.getInitializer();
          if (!initializer || !Node.isStringLiteral(initializer)) continue;

          const value = initializer.getLiteralValue();
          if (!tokenColorValues.has(value.toLowerCase())) continue;

          violations.push({
            file: filePath,
            line: getLineNumber(attr),
            ruleId: "hardcoded-svg-color",
            severity: "warning",
            message: `Hardcoded ${attrName}="${value}" duplicates a token color — use ${attrName}="currentColor" and set the text color instead, matching the Icon component's own convention.`,
            matchedCode: attr.getText(),
          });
        }
      }

      return violations;
    },
  };
}
