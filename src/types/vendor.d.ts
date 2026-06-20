declare module 'xpath' {
  export function select(
    expression: string,
    node: Node,
  ): Node[] | Node | string | number | boolean | null;

  export function useNamespaces(arg0: { x: string; }) {
    throw new Error('Function not implemented.');
  }
}

declare module '@xmldom/xmldom' {
  export class DOMParser {
    parseFromString(source: string, mimeType: string): Document;
  }
}
