import { Project } from "ts-morph";
import { buildComponentRegistry, type ComponentRegistry } from "./component-registry.js";
import { applyRuleConfig, buildAllRules, type RuleConfig } from "./rule-registry.js";
import type { Violation } from "./types.js";

export interface AnalyzeOptions {
  config?: RuleConfig;
  componentRegistry?: ComponentRegistry;
}

/** Analyzes one or more files, returning every rule's violations sorted by file then line. */
export function analyzeFiles(filePaths: string[], options: AnalyzeOptions = {}): Violation[] {
  const project = new Project({ useInMemoryFileSystem: false, skipAddingFilesFromTsConfig: true });
  project.addSourceFilesAtPaths(filePaths);

  const componentRegistry = options.componentRegistry ?? buildComponentRegistry();
  const rules = applyRuleConfig(buildAllRules(componentRegistry), options.config);

  const violations: Violation[] = [];
  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    for (const rule of rules) {
      violations.push(...rule.check({ sourceFile, filePath }));
    }
  }

  return violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}
