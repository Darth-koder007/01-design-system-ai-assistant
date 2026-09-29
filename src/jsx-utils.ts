import type { JsxAttribute, JsxOpeningElement, JsxSelfClosingElement, SourceFile } from "ts-morph";
import { Node, SyntaxKind } from "ts-morph";

export type JsxTagLike = JsxOpeningElement | JsxSelfClosingElement;

export function getJsxTagLikeElements(sourceFile: SourceFile): JsxTagLike[] {
  return [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ];
}

export function getTagName(element: JsxTagLike): string {
  return element.getTagNameNode().getText();
}

export function getAttribute(element: JsxTagLike, name: string): JsxAttribute | undefined {
  const attr = element
    .getAttributes()
    .find((a): a is JsxAttribute => Node.isJsxAttribute(a) && a.getNameNode().getText() === name);
  return attr;
}

export function getAttributeStringValue(element: JsxTagLike, name: string): string | undefined {
  const attr = getAttribute(element, name);
  const initializer = attr?.getInitializer();
  if (!initializer) return undefined;

  if (Node.isStringLiteral(initializer)) {
    return initializer.getLiteralValue();
  }
  return undefined;
}

export function getLineNumber(node: Node): number {
  return node.getSourceFile().getLineAndColumnAtPos(node.getStart()).line;
}
