/**
 * 搜索阶段：HTTP 请求搜索页 → 反爬检测 → XPath 解析结果。
 *
 * 对应 Kazumi `Plugin.queryBangumi`。
 */
import { detectsCaptchaChallenge } from '../anti-crawler/captcha-detector';
import type { CookieStore } from '../http/cookie-store';
import { globalCookieStore } from '../http/cookie-store';
import type { HttpClient } from '../http/http-client';
import { defaultHttpClient } from '../http/http-client';
import {
  CaptchaRequiredError,
  NoResultError,
  SearchError,
} from '../models/errors';
import type { PluginRule } from '../models/plugin-rule';
import type {
  PluginSearchResponse,
  SearchItem,
} from '../models/search-item';
import {
  parseHtmlDocument,
  queryXPathList,
} from '../parse/xpath-html-parser';

export type SearchStageOptions = {
  /** 为 true 时非 Captcha/NoResult 错误会包装为 SearchError 抛出；false 时返回空 data */
  shouldRethrow?: boolean;
  /** 传入 AbortSignal 可在请求中途取消搜索 */
  signal?: AbortSignal;
};

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new SearchError('unknown', 'aborted');
  }
}

/** 将 @keyword 替换为 URL 编码后的搜索词 */
function buildSearchUrl(rule: PluginRule, keyword: string): string {
  return rule.searchURL.replace(
    '@keyword',
    encodeURIComponent(keyword),
  );
}

/** usePost 模式下，从 searchURL 的 query 提取 POST body 参数 */
function parseQueryParams(url: string): Record<string, string> {
  const uri = new URL(url);
  const params: Record<string, string> = {};
  uri.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

export class SearchStage {
  constructor(
    private readonly http: HttpClient = defaultHttpClient,
    private readonly cookieStore: CookieStore = globalCookieStore,
  ) {}

  /**
   * 执行完整搜索流程。
   * shouldRethrow 为 false（默认）时，普通错误返回空结果而非抛错。
   */
  async search(
    rule: PluginRule,
    keyword: string,
    options: SearchStageOptions = {},
  ): Promise<PluginSearchResponse> {
    try {
      throwIfAborted(options.signal);
      const queryURL = buildSearchUrl(rule, keyword);
      const cookieHeader = this.cookieStore.getCookieHeader(rule.name, queryURL);
      const referer = `${rule.baseUrl.replace(/\/$/, '')}/`;

      let htmlString: string;
      if (rule.usePost) {
        const uri = new URL(queryURL);
        const postUrl = `${uri.protocol}//${uri.host}${uri.pathname}`;
        htmlString = (
          await this.http.postFormText(
            postUrl,
            parseQueryParams(queryURL),
            {
              referer,
              ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            },
          )
        ).text;
      } else {
        htmlString = (
          await this.http.getText(queryURL, {
            referer,
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          })
        ).text;
      }
      throwIfAborted(options.signal);
      return this.parseSearchHtml(rule, htmlString);
    } catch (error) {
      if (
        error instanceof CaptchaRequiredError ||
        error instanceof NoResultError
      ) {
        throw error;
      }
      if (options.shouldRethrow) {
        throw new SearchError(rule.name, error);
      }
      return { pluginName: rule.name, data: [] };
    }
  }

  /**
   * 解析已获取的 HTML（可用于验证码 WebView 验证后重试解析）。
   * 命中反爬配置时抛出 CaptchaRequiredError。
   */
  parseSearchHtml(rule: PluginRule, htmlString: string): PluginSearchResponse {
    const document = parseHtmlDocument(htmlString);
    if (detectsCaptchaChallenge(htmlString, rule.antiCrawlerConfig, document)) {
      throw new CaptchaRequiredError(rule.name);
    }

    const searchItems: SearchItem[] = queryXPathList(
      document,
      rule.searchList,
      rule.searchName,
      rule.searchResult,
    );

    if (searchItems.length === 0) {
      throw new NoResultError(rule.name);
    }

    return { pluginName: rule.name, data: searchItems };
  }

  /** 仅拉取搜索页 HTML，不做解析（供验证码 WebView 预加载等场景） */
  async fetchSearchHtml(
    rule: PluginRule,
    keyword: string,
    signal?: AbortSignal,
  ): Promise<string> {
    const queryURL = buildSearchUrl(rule, keyword);
    const referer = `${rule.baseUrl.replace(/\/$/, '')}/`;
    throwIfAborted(signal);

    if (rule.usePost) {
      const uri = new URL(queryURL);
      const postUrl = `${uri.protocol}//${uri.host}${uri.pathname}`;
      return (
        await this.http.postFormText(postUrl, parseQueryParams(queryURL), {
          referer,
        })
      ).text;
    }
    return (await this.http.getText(queryURL, { referer })).text;
  }
}

export const defaultSearchStage = new SearchStage();
