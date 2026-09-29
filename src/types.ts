import type { SourceFile } from "ts-morph";

export type Severity = "error" | "warning";

export interface Violation {
  file: string;
  line: number;
  ruleId: string;
  severity: Severity;
  message: string;
  matchedCode: string;
}

export interface RuleContext {
  sourceFile: SourceFile;
  filePath: string;
}

export interface Rule {
  id: string;
  description: string;
  defaultSeverity: Severity;
  check(context: RuleContext): Violation[];
}
