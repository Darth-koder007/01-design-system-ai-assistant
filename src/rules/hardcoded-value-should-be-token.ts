import { Node, SyntaxKind } from "ts-morph";
import { color } from "@ds/tokens";
import { getLineNumber } from "../jsx-utils.js";
import type { Rule, RuleContext, Violation } from "../types.js";

function buildValueToTokenMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [rampName, steps] of Object.entries(color)) {
    for (const [step, value] of Object.entries(steps)) {
      map.set(value.toLowerCase(), `color.${rampName}.${step}`);
    }
  }
  return map;
}

export function createHardcodedValueShouldBeTokenRule(): Rule {
  const valueToToken = buildValueToTokenMap();

  return {
    id: "hardcoded-value-should-be-token",
    description: "Flags inline style values that duplicate an exact design-token color value.",
    defaultSeverity: "warning",
    check(context: RuleContext): Violation[] {
      const { sourceFile, filePath } = context;
      const violations: Violation[] = [];

      for (const attr of sourceFile.getDescendantsOfKind(SyntaxKind.JsxAttribute)) {
        if (attr.getNameNode().getText() !== "style") continue;

        const initializer = attr.getInitializer();
        if (!Node.isJsxExpression(initializer)) continue;

        const objectLiteral = initializer.getExpression();
        if (!objectLiteral || !Node.isObjectLiteralExpression(objectLiteral)) continue;

        for (const prop of objectLiteral.getProperties()) {
          if (!Node.isPropertyAssignment(prop)) continue;

          const valueNode = prop.getInitializer();
          if (!valueNode || !Node.isStringLiteral(valueNode)) continue;

          const tokenName = valueToToken.get(valueNode.getLiteralValue().toLowerCase());
          if (!tokenName) continue;

          violations.push({
            file: filePath,
            line: getLineNumber(prop),
            ruleId: "hardcoded-value-should-be-token",
            severity: "warning",
            message: `Hardcoded value "${valueNode.getLiteralValue()}" matches design token ${tokenName} — use var(--ds-${tokenName.replace(/\./g, "-")}) instead.`,
            matchedCode: prop.getText(),
          });
        }
      }

      return violations;
    },
  };
}
