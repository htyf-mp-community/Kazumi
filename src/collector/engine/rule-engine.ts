/**
 * 规则引擎：对外统一入口，编排 Search / Road / Video 三阶段。
 *
 * 对应 Kazumi 中 PluginSearchService + Plugin.queryBangumi 等能力的 RN 聚合层。
 */
import { PLUGIN_API_LEVEL } from '../constants';
import type { CookieStore } from '../http/cookie-store';
import { globalCookieStore } from '../http/cookie-store';
import type { HttpClient } from '../http/http-client';
import { defaultHttpClient } from '../http/http-client';
import type { RoadStage } from './road-stage';
import { defaultRoadStage } from './road-stage';
import type { SearchStage } from './search-stage';
import { defaultSearchStage } from './search-stage';
import type { PluginRule } from '../models/plugin-rule';
import type { PluginSearchResponse } from '../models/search-item';
import type { Road } from '../models/road';
import type { ResolveVideoOptions, VideoSource } from '../models/video-source';
import type { VideoSniffer } from '../webview/video-sniffer-types';

/** 并发搜索多个插件时的单项结果（含状态，不抛错） */
export type SearchAllResult = {
  /** 插件规则 name */
  pluginName: string;
  /**
   * 搜索状态：
   * - `success`：有搜索结果
   * - `noResult`：解析成功但列表为空
   * - `captcha`：命中验证页
   * - `error`：网络或其他异常
   */
  status: 'success' | 'noResult' | 'captcha' | 'error';
  /** status 为 success 时的搜索响应 */
  response?: PluginSearchResponse;
  /** status 非 success 时的原始错误对象 */
  error?: unknown;
};

export class RuleEngine {
  constructor(
    private readonly searchStage: SearchStage = defaultSearchStage,
    private readonly roadStage: RoadStage = defaultRoadStage,
    private readonly cookieStore: CookieStore = globalCookieStore,
    private readonly videoSniffer?: VideoSniffer,
  ) {}

  search(rule: PluginRule, keyword: string): Promise<PluginSearchResponse> {
    return this.searchStage.search(rule, keyword, { shouldRethrow: true });
  }

  /** 并发搜索全部插件，将 Captcha/NoResult/Error 转为 status 字段 */
  async searchAll(
    rules: PluginRule[],
    keyword: string,
    onResult?: (result: SearchAllResult, index: number) => void,
  ): Promise<SearchAllResult[]> {
    const tasks = rules.map(async (rule, index): Promise<SearchAllResult> => {
      const result = await this.searchOneRule(rule, keyword);
      onResult?.(result, index);
      return result;
    });
    return Promise.all(tasks);
  }

  private async searchOneRule(
    rule: PluginRule,
    keyword: string,
  ): Promise<SearchAllResult> {
    try {
      const response = await this.search(rule, keyword);
      return {
        pluginName: rule.name,
        status: response.data.length > 0 ? 'success' : 'noResult',
        response,
      };
    } catch (error) {
      const name = rule.name;
      if (error instanceof Error && error.name === 'CaptchaRequiredError') {
        return { pluginName: name, status: 'captcha', error };
      }
      if (error instanceof Error && error.name === 'NoResultError') {
        return { pluginName: name, status: 'noResult', error };
      }
      return { pluginName: name, status: 'error', error };
    }
  }

  fetchRoads(rule: PluginRule, detailUrl: string): Promise<Road[]> {
    return this.roadStage.fetchRoads(rule, detailUrl);
  }

  buildEpisodeUrl(rule: PluginRule, href: string): string {
    return this.roadStage.buildFullUrl(rule, href);
  }

  /** 通过 WebView 嗅探单集真实播放地址，需 CollectorProvider 注入 VideoSniffer */
  async resolveVideo(
    rule: PluginRule,
    episodeUrl: string,
    options?: ResolveVideoOptions,
  ): Promise<VideoSource> {
    if (!this.videoSniffer) {
      throw new Error('VideoSniffer is not configured');
    }
    const fullUrl = this.roadStage.buildFullUrl(rule, episodeUrl);
    return this.videoSniffer.resolve(fullUrl, {
      useLegacyParser: rule.useLegacyParser,
      referer: rule.referer || rule.baseUrl,
      userAgent: rule.userAgent,
      ...options,
    });
  }

  /** 验证码 WebView 验证通过后，将 document.cookie 写入内存存储 */
  saveCaptchaCookies(
    pluginName: string,
    pageUrl: string,
    cookieString: string,
  ): void {
    this.cookieStore.saveFromDocumentCookie(pluginName, pageUrl, cookieString);
  }

  isPluginCompatible(rule: PluginRule): boolean {
    const api = Number.parseInt(rule.api, 10);
    return Number.isFinite(api) && api <= PLUGIN_API_LEVEL;
  }
}

export function createRuleEngine(videoSniffer?: VideoSniffer): RuleEngine {
  return new RuleEngine(
    defaultSearchStage,
    defaultRoadStage,
    globalCookieStore,
    videoSniffer,
  );
}
