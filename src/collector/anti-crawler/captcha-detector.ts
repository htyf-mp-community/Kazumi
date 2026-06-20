/**
 * 验证码页检测，对应 Kazumi `Plugin.detectsCaptchaChallenge`。
 *
 * 检测策略（按优先级）：
 * 1. captchaDetectValue 非空 → 按 captchaDetectType（text / regex / xpath）匹配
 * 2. 否则 fallback 到 captchaImage / captchaButton 的 XPath 是否存在
 *
 * text / regex 检测不解析 DOM，xpath 路径才按需 parseHtmlDocument。
 */
import {
  CaptchaDetectType,
  type AntiCrawlerConfig,
} from '../models/anti-crawler-config';
import { parseHtmlDocument, queryXPathNodes } from '../parse/xpath-html-parser';

function hasXPathMatch(context: Node, expression: string): boolean {
  return queryXPathNodes(context, expression).length > 0;
}

function resolveDocument(htmlString: string, document?: Document): Document {
  return document ?? parseHtmlDocument(htmlString);
}

function matchTextDetectValue(htmlString: string, detectValue: string): boolean {
  return htmlString.includes(detectValue);
}

function matchRegexDetectValue(htmlString: string, detectValue: string): boolean {
  try {
    return new RegExp(detectValue, 'is').test(htmlString);
  } catch {
    return false;
  }
}

function collectFallbackXpaths(config: AntiCrawlerConfig): string[] {
  return [config.captchaImage, config.captchaButton].filter(
    (xpath) => xpath.trim().length > 0,
  );
}

function matchConfiguredDetectValue(
  htmlString: string,
  config: AntiCrawlerConfig,
  detectValue: string,
  document?: Document,
): boolean {
  switch (config.captchaDetectType) {
    case CaptchaDetectType.text:
      return matchTextDetectValue(htmlString, detectValue);
    case CaptchaDetectType.regex:
      return matchRegexDetectValue(htmlString, detectValue);
    case CaptchaDetectType.xpath:
    default:
      return hasXPathMatch(resolveDocument(htmlString, document), detectValue);
  }
}

function matchFallbackXpaths(
  htmlString: string,
  config: AntiCrawlerConfig,
  document?: Document,
): boolean {
  const fallbackXpaths = collectFallbackXpaths(config);
  if (fallbackXpaths.length === 0) {
    return false;
  }

  const doc = resolveDocument(htmlString, document);
  return fallbackXpaths.some((xpath) => hasXPathMatch(doc, xpath));
}

/**
 * 判断搜索响应 HTML 是否为验证码挑战页。
 *
 * @param htmlString 搜索 HTTP 响应体
 * @param config 规则中的 antiCrawlerConfig
 * @param document 可选；调用方已 parse 时传入，避免 text/regex 路径外的重复解析
 * @returns true 表示需要走 WebView 验证流程
 */
export function detectsCaptchaChallenge(
  htmlString: string,
  config: AntiCrawlerConfig,
  document?: Document,
): boolean {
  if (!config.enabled) {
    return false;
  }

  const detectValue = config.captchaDetectValue.trim();
  if (detectValue) {
    return matchConfiguredDetectValue(htmlString, config, detectValue, document);
  }

  return matchFallbackXpaths(htmlString, config, document);
}
