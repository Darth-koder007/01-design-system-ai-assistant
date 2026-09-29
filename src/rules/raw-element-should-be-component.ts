import {
  getAttributeStringValue,
  getJsxTagLikeElements,
  getLineNumber,
  getTagName,
} from "../jsx-utils.js";
import type { JsxTagLike } from "../jsx-utils.js";
import type { Rule, RuleContext, Violation } from "../types.js";

const TEXT_LIKE_INPUT_TYPES = new Set([
  "text",
  "email",
  "password",
  "number",
  "tel",
  "url",
  "search",
]);

interface Mapping {
  tag: string;
  componentName: string;
  predicate?: (element: JsxTagLike) => boolean;
}

const MAPPINGS: Mapping[] = [
  { tag: "button", componentName: "Button" },
  { tag: "select", componentName: "Select" },
  {
    tag: "input",
    componentName: "Checkbox",
    predicate: (el) => getAttributeStringValue(el, "type") === "checkbox",
  },
  {
    tag: "input",
    componentName: "Radio",
    predicate: (el) => getAttributeStringValue(el, "type") === "radio",
  },
  {
    tag: "input",
    componentName: "Input",
    predicate: (el) => {
      const type = getAttributeStringValue(el, "type");
      return type === undefined || TEXT_LIKE_INPUT_TYPES.has(type);
    },
  },
];

export function createRawElementShouldBeComponentRule(): Rule {
  return {
    id: "raw-element-should-be-component",
    description:
      "Flags raw HTML elements that duplicate a design-system component's semantic role.",
    defaultSeverity: "warning",
    check(context: RuleContext): Violation[] {
      const { sourceFile, filePath } = context;
      const violations: Violation[] = [];

      for (const element of getJsxTagLikeElements(sourceFile)) {
        const tagName = getTagName(element);
        const mapping = MAPPINGS.find(
          (m) => m.tag === tagName && (!m.predicate || m.predicate(element))
        );
        if (!mapping) continue;

        violations.push({
          file: filePath,
          line: getLineNumber(element),
          ruleId: "raw-element-should-be-component",
          severity: "warning",
          message: `Raw <${tagName}> should be <${mapping.componentName}> from the design system.`,
          matchedCode: element.getText(),
        });
      }

      return violations;
    },
  };
}
