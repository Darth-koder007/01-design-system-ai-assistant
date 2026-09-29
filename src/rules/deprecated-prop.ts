import type { ComponentRegistry } from "../component-registry.js";
import { getDesignSystemImportNames } from "../import-utils.js";
import { getAttribute, getJsxTagLikeElements, getLineNumber, getTagName } from "../jsx-utils.js";
import type { Rule, RuleContext, Violation } from "../types.js";

export function createDeprecatedPropRule(registry: ComponentRegistry): Rule {
  return {
    id: "deprecated-prop",
    description: "Flags usage of a design-system component prop marked @deprecated.",
    defaultSeverity: "warning",
    check(context: RuleContext): Violation[] {
      const { sourceFile, filePath } = context;
      const importedNames = getDesignSystemImportNames(sourceFile);
      const violations: Violation[] = [];

      for (const element of getJsxTagLikeElements(sourceFile)) {
        const tagName = getTagName(element);
        if (!importedNames.has(tagName)) continue;

        const componentInfo = registry.get(tagName);
        if (!componentInfo) continue;

        for (const prop of componentInfo.props) {
          if (!prop.deprecated) continue;

          const attr = getAttribute(element, prop.name);
          if (!attr) continue;

          violations.push({
            file: filePath,
            line: getLineNumber(attr),
            ruleId: "deprecated-prop",
            severity: "warning",
            message: `<${tagName}> prop "${prop.name}" is deprecated.${
              prop.deprecationMessage ? ` ${prop.deprecationMessage}` : ""
            }`,
            matchedCode: attr.getText(),
          });
        }
      }

      return violations;
    },
  };
}
