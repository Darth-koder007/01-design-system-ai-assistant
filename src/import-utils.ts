import type { SourceFile } from "ts-morph";

const DESIGN_SYSTEM_MODULE = "@ds/components";

/** Names imported from the design system in this file, e.g. `import { Button, Input } from "@ds/components"`. */
export function getDesignSystemImportNames(sourceFile: SourceFile): Set<string> {
  const names = new Set<string>();

  for (const importDecl of sourceFile.getImportDeclarations()) {
    if (importDecl.getModuleSpecifierValue() !== DESIGN_SYSTEM_MODULE) continue;

    for (const named of importDecl.getNamedImports()) {
      names.add((named.getAliasNode() ?? named.getNameNode()).getText());
    }
  }

  return names;
}
