import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Project } from "ts-morph";

export interface PropInfo {
  name: string;
  deprecated: boolean;
  deprecationMessage?: string;
}

export interface ComponentInfo {
  name: string;
  props: PropInfo[];
}

export type ComponentRegistry = Map<string, ComponentInfo>;

function resolveComponentsSourceDir(): string {
  const require = createRequire(import.meta.url);
  const packageJsonPath = require.resolve("@ds/components/package.json");
  return join(dirname(packageJsonPath), "src");
}

function extractPropsFromInterface(interfaceName: string, project: Project): PropInfo[] {
  const props: PropInfo[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const iface = sourceFile.getInterface(interfaceName);
    if (!iface) continue;

    for (const member of iface.getProperties()) {
      const jsDocs = member.getJsDocs();
      const deprecatedTag = jsDocs
        .flatMap((doc) => doc.getTags())
        .find((tag) => tag.getTagName() === "deprecated");

      const deprecationMessage = deprecatedTag?.getCommentText()?.trim();
      props.push({
        name: member.getName(),
        deprecated: Boolean(deprecatedTag),
        ...(deprecationMessage !== undefined ? { deprecationMessage } : {}),
      });
    }
    return props;
  }

  return props;
}

export function buildComponentRegistry(
  sourceDir = resolveComponentsSourceDir()
): ComponentRegistry {
  const project = new Project({ useInMemoryFileSystem: false, skipAddingFilesFromTsConfig: true });
  project.addSourceFilesAtPaths(join(sourceDir, "*.tsx"));

  const registry: ComponentRegistry = new Map();

  for (const sourceFile of project.getSourceFiles()) {
    if (
      sourceFile.getBaseName().includes(".stories.") ||
      sourceFile.getBaseName().includes(".test.")
    ) {
      continue;
    }

    for (const name of sourceFile.getExportedDeclarations().keys()) {
      const propsInterfaceName = `${name}Props`;
      if (!sourceFile.getInterface(propsInterfaceName)) continue;

      registry.set(name, {
        name,
        props: extractPropsFromInterface(propsInterfaceName, project),
      });
    }
  }

  return registry;
}
