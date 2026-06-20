/**
 * HTML XPath 解析器（React Native 可用）。
 *
 * 使用 xmldom + xpath 纯 JS 实现，无 Node cheerio / canvas 依赖。
 * 针对 Kazumi 规则做了两处兼容：
 * 1. text/html 文档的 XHTML namespace（自动加 x: 前缀重试）
 * 2. 子节点上下文下 // 开头的表达式转为相对路径（.//...）
 */
import xpath from 'xpath';
import { DOMParser } from '@xmldom/xmldom';

type DomElement = Node & {
  textContent?: string | null;
  nodeValue?: string | null;
  getAttribute?: (name: string) => string | null;
};

const selectWithXhtmlNs = xpath.useNamespaces({
  x: 'http://www.w3.org/1999/xhtml',
});

/** 将 //div/div[2]/a 转为 //x:div/x:div[2]/x:a，兼容 HTML5 namespace */
function toXhtmlExpression(expression: string): string {
  return expression.replace(
    /(^|\/{1,2}|\.\/{1,2})([A-Za-z_][\w-]*)(?=(?:\[[^\]]*\])?(?:\/|$))/g,
    (full, prefix: string, name: string) => {
      if (
        name === 'text' ||
        name === 'node' ||
        name === 'comment' ||
        name === 'processing-instruction' ||
        name.includes(':')
      ) {
        return full;
      }
      return `${prefix}x:${name}`;
    },
  );
}

/** 在非 document 节点上查询时，将 // 改为 .// 避免跨文档全局匹配 */
function toScopedExpression(context: Node, expression: string): string {
  const trimmed = expression.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (
    context.nodeType !== 9 &&
    (trimmed.startsWith('//') || trimmed.startsWith('/'))
  ) {
    return `.${trimmed}`;
  }
  return trimmed;
}

export function parseHtmlDocument(html: string): Document {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc as unknown as Document;
}

/** 执行 XPath 查询，失败或无匹配时返回空数组 */
export function queryXPathNodes(context: Node, expression: string): Node[] {
  const scopedExpression = toScopedExpression(context, expression);
  if (!scopedExpression) {
    return [];
  }

  const toNodeArray = (selected: unknown): Node[] => {
    if (Array.isArray(selected)) {
      return selected.filter(
        (node): node is Node =>
          typeof node === 'object' &&
          node !== null &&
          'nodeType' in node &&
          typeof (node as Node).nodeType === 'number',
      );
    }
    return selected &&
      typeof selected === 'object' &&
      'nodeType' in selected
      ? [selected as Node]
      : [];
  };

  try {
    const direct = toNodeArray(xpath.select(scopedExpression, context));
    if (direct.length > 0) {
      return direct;
    }

    const xhtmlExpression = toXhtmlExpression(scopedExpression);
    if (xhtmlExpression !== scopedExpression) {
      const namespaced = toNodeArray(selectWithXhtmlNs(xhtmlExpression, context));
      if (namespaced.length > 0) {
        return namespaced;
      }
    }

    return [];
  } catch {
    return [];
  }
}

export function queryXPathText(context: Node, expression: string): string {
  const nodes = queryXPathNodes(context, expression);
  const first = nodes[0] as DomElement | undefined;
  if (!first) {
    return '';
  }
  return (first.textContent ?? first.nodeValue ?? '').trim();
}

export function queryXPathAttribute(
  context: Node,
  expression: string,
  attribute: string,
): string {
  const nodes = queryXPathNodes(context, expression);
  const first = nodes[0] as DomElement | undefined;
  if (!first) {
    return '';
  }
  const fromElement = first.getAttribute?.(attribute);
  if (fromElement) {
    return fromElement;
  }
  // 支持 //a/@href、@href 等返回属性节点的情况
  return first.nodeValue ?? '';
}

/**
 * 搜索页专用：遍历 searchList，提取每项的 name 与 href。
 * 单条解析失败时跳过，与 Kazumi Plugin.queryBangumi 行为一致。
 */
export function queryXPathList(
  document: Document,
  listExpression: string,
  nameExpression: string,
  resultExpression: string,
): Array<{ name: string; src: string }> {
  const items: Array<{ name: string; src: string }> = [];
  for (const node of queryXPathNodes(document, listExpression)) {
    try {
      const name = queryXPathText(node, nameExpression);
      const src = queryXPathAttribute(node, resultExpression, 'href');
      if (name || src) {
        items.push({ name, src });
      }
    } catch {
      // 单条失败跳过
    }
  }
  return items;
}
