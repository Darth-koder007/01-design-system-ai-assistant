import type { ComponentRegistry } from "./component-registry.js";
import { createDeprecatedPropRule } from "./rules/deprecated-prop.js";
import { createHardcodedSvgColorRule } from "./rules/hardcoded-svg-color.js";
import { createHardcodedValueShouldBeTokenRule } from "./rules/hardcoded-value-should-be-token.js";
import { createRawElementShouldBeComponentRule } from "./rules/raw-element-should-be-component.js";
import type { Rule, Severity } from "./types.js";

export interface RuleConfigEntry {
  enabled?: boolean;
  severity?: Severity;
}

export type RuleConfig = Record<string, RuleConfigEntry>;

/** Builds the full set of known rules. Order doesn't affect output — `analyze` merges results. */
export function buildAllRules(componentRegistry: ComponentRegistry): Rule[] {
  return [
    createRawElementShouldBeComponentRule(),
    createHardcodedValueShouldBeTokenRule(),
    createDeprecatedPropRule(componentRegistry),
    createHardcodedSvgColorRule(),
  ];
}

/** Applies a config's enable/disable + severity overrides, producing the rules that should actually run. */
export function applyRuleConfig(rules: Rule[], config: RuleConfig = {}): Rule[] {
  return rules
    .filter((rule) => config[rule.id]?.enabled !== false)
    .map((rule) => {
      const overrideSeverity = config[rule.id]?.severity;
      if (!overrideSeverity) return rule;

      return {
        ...rule,
        check: (context: Parameters<Rule["check"]>[0]) =>
          rule.check(context).map((violation) => ({ ...violation, severity: overrideSeverity })),
      };
    });
}
