import { createPatch } from "diff";
import { fileURLToPath } from "node:url";
import { Node, Project, SyntaxKind } from "ts-morph";
import type { ComponentRegistry } from "./component-registry.js";
import { getAttribute, getJsxTagLikeElements, getLineNumber, getTagName } from "./jsx-utils.js";
import { MAPPINGS } from "./rules/raw-element-should-be-component.js";
import type { Violation } from "./types.js";

export interface CodemodResult {
  diff: string;
  typeChecks: boolean;
}

function ensureDesignSystemImport(sourceFile: import("ts-morph").SourceFile, name: string): void {
  const existing = sourceFile
    .getImportDeclarations()
    .find((d) => d.getModuleSpecifierValue() === "@ds/components");

  if (!existing) {
    sourceFile.addImportDeclaration({ moduleSpecifier: "@ds/components", namedImports: [name] });
    return;
  }

  const alreadyImported = existing.getNamedImports().some((named) => named.getName() === name);
  if (!alreadyImported) {
    existing.addNamedImport(name);
  }
}

function renameJsxTag(element: ReturnType<typeof getJsxTagLikeElements>[number], newName: string) {
  element.getTagNameNode().replaceWithText(newName);

  if (Node.isJsxOpeningElement(element)) {
    const jsxElement = element.getParentIfKind(SyntaxKind.JsxElement);
    jsxElement?.getClosingElement().getTagNameNode().replaceWithText(newName);
  }
}

function countDiagnostics(sourceFile: import("ts-morph").SourceFile): number {
  return sourceFile.getPreEmitDiagnostics().length;
}

function applyRawElementCodemod(
  sourceFile: import("ts-morph").SourceFile,
  violation: Violation
): boolean {
  const element = getJsxTagLikeElements(sourceFile).find(
    (el) => getLineNumber(el) === violation.line
  );
  if (!element) return false;

  const tagName = getTagName(element);
  const mapping = MAPPINGS.find((m) => m.tag === tagName && (!m.predicate || m.predicate(element)));
  if (!mapping) return false;

  for (const attrName of mapping.dropAttributes) {
    getAttribute(element, attrName)?.remove();
  }
  renameJsxTag(element, mapping.componentName);
  ensureDesignSystemImport(sourceFile, mapping.componentName);
  return true;
}

function applyDeprecatedPropCodemod(
  sourceFile: import("ts-morph").SourceFile,
  violation: Violation,
  componentRegistry: ComponentRegistry
): boolean {
  const element = getJsxTagLikeElements(sourceFile).find(
    (el) => getLineNumber(el) === violation.line
  );
  if (!element) return false;

  const tagName = getTagName(element);
  const componentInfo = componentRegistry.get(tagName);
  if (!componentInfo) return false;

  for (const prop of componentInfo.props) {
    if (!prop.deprecated || !prop.replacementProp) continue;
    const attr = getAttribute(element, prop.name);
    if (!attr) continue;

    attr.getNameNode().replaceWithText(prop.replacementProp);
    return true;
  }

  return false;
}

/**
 * Generates a codemod for violations with a known mechanical fix. Returns null when there's no
 * mechanical fix available (e.g. `select` -> `Select` needs an `options` prop this tool can't
 * safely synthesize from JSX children) or when the generated change doesn't type-check —
 * callers should fall back to explanation-only in both cases, never present a broken diff.
 */
export function generateCodemod(
  filePath: string,
  violation: Violation,
  componentRegistry: ComponentRegistry
): CodemodResult | null {
  if (
    violation.ruleId !== "raw-element-should-be-component" &&
    violation.ruleId !== "deprecated-prop"
  ) {
    return null;
  }

  const tsConfigFilePath = fileURLToPath(new URL("../tsconfig.json", import.meta.url));
  const project = new Project({ tsConfigFilePath, skipAddingFilesFromTsConfig: true });
  const sourceFile = project.addSourceFileAtPath(filePath);
  const originalText = sourceFile.getFullText();

  const applied =
    violation.ruleId === "raw-element-should-be-component"
      ? applyRawElementCodemod(sourceFile, violation)
      : applyDeprecatedPropCodemod(sourceFile, violation, componentRegistry);

  if (!applied) return null;

  const modifiedText = sourceFile.getFullText();
  const typeChecks = countDiagnostics(sourceFile) === 0;

  const diff = createPatch(filePath, originalText, modifiedText);
  return { diff, typeChecks };
}
