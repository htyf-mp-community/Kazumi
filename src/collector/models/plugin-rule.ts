/**
 * 插件规则模型，对应 Kazumi 规则 JSON（KazumiRules 仓库格式）。
 *
 * 规则通过 XPath 描述如何从 HTML 中提取搜索结果与播放线路；
 * searchURL 中的 `@keyword` 会在搜索时替换为 encodeURIComponent 后的关键词。
 */
import {
  emptyAntiCrawlerConfig,
  parseAntiCrawlerConfig,
  type AntiCrawlerConfig,
} from './anti-crawler-config';

/** Kazumi 插件规则，序列化字段名见 pluginRuleToJson */
export type PluginRule = {
  /**
   * 规则 API 版本号（字符串形式的整数）。
   * 需 <= PLUGIN_API_LEVEL，否则 RuleEngine.isPluginCompatible 返回 false。
   */
  api: string;
  /** 内容类型，通常为 `anime` */
  type: string;
  /** 规则唯一标识，用作 CookieStore key 及搜索结果归属 */
  name: string;
  /** 规则版本号，仅作展示/兼容性参考 */
  version: string;
  /**
   * 同页是否存在多个视频源。
   * true 时 resolveVideo 可通过 offset 选取第 N 个候选源。
   */
  muliSources: boolean;
  /** 是否需要 WebView 嗅探真实播放地址；false 时 episode URL 本身应可直接播放 */
  useWebview: boolean;
  /** 是否使用原生播放器（RN 端保留字段，与 Kazumi 对齐，当前恒为 true） */
  useNativePlayer: boolean;
  /**
   * 搜索是否使用 POST。
   * true 时从 searchURL 的 query 提取参数作为 POST body，URL 路径不含 query。
   */
  usePost: boolean;
  /**
   * 视频嗅探模式。
   * true：Legacy iframe 嗅探；false：现代 XHR/Response 拦截 + video 标签监听。
   */
  useLegacyParser: boolean;
  /** 是否在 WebView 嗅探时过滤广告域名请求 */
  adBlocker: boolean;
  /** 自定义 User-Agent；空字符串时 HTTP/WebView 使用随机 UA */
  userAgent: string;
  /** 站点根 URL，用于拼接相对路径及构造 referer */
  baseUrl: string;
  /** 搜索地址模板，含 `@keyword` 占位符 */
  searchURL: string;
  /** 搜索结果列表项 XPath（相对于 document） */
  searchList: string;
  /** 标题 XPath（相对于 searchList 的每个列表项） */
  searchName: string;
  /** 详情链接 XPath（相对于 searchList 的每个列表项，通常取 href） */
  searchResult: string;
  /** 播放线路容器 XPath（相对于 document） */
  chapterRoads: string;
  /** 集数链接 XPath（相对于 chapterRoads 的每个线路容器） */
  chapterResult: string;
  /** 播放/嗅探时使用的 Referer；空则 fallback 到 baseUrl */
  referer: string;
  /** 反反爬虫配置，见 AntiCrawlerConfig */
  antiCrawlerConfig: AntiCrawlerConfig;
};

/** 从规则 JSON 对象解析，兼容 baseURL / baseUrl 两种字段名 */
export function parsePluginRule(json: Record<string, unknown>): PluginRule {
  return {
    api: String(json.api ?? '1'),
    type: String(json.type ?? 'anime'),
    name: String(json.name ?? ''),
    version: String(json.version ?? ''),
    muliSources: Boolean(json.muliSources ?? true),
    useWebview: Boolean(json.useWebview ?? true),
    useNativePlayer: Boolean(json.useNativePlayer ?? true),
    usePost: Boolean(json.usePost ?? false),
    useLegacyParser: Boolean(json.useLegacyParser ?? false),
    adBlocker: Boolean(json.adBlocker ?? false),
    userAgent: String(json.userAgent ?? ''),
    baseUrl: String(json.baseURL ?? json.baseUrl ?? ''),
    searchURL: String(json.searchURL ?? ''),
    searchList: String(json.searchList ?? ''),
    searchName: String(json.searchName ?? ''),
    searchResult: String(json.searchResult ?? ''),
    chapterRoads: String(json.chapterRoads ?? ''),
    chapterResult: String(json.chapterResult ?? ''),
    referer: String(json.referer ?? ''),
    antiCrawlerConfig: parseAntiCrawlerConfig(
      json.antiCrawlerConfig as Record<string, unknown> | undefined,
    ),
  };
}

/** 序列化为 Kazumi 规则 JSON 格式（baseUrl → baseURL） */
export function pluginRuleToJson(rule: PluginRule): Record<string, unknown> {
  return {
    api: rule.api,
    type: rule.type,
    name: rule.name,
    version: rule.version,
    muliSources: rule.muliSources,
    useWebview: rule.useWebview,
    useNativePlayer: rule.useNativePlayer,
    usePost: rule.usePost,
    useLegacyParser: rule.useLegacyParser,
    adBlocker: rule.adBlocker,
    userAgent: rule.userAgent,
    baseURL: rule.baseUrl,
    searchURL: rule.searchURL,
    searchList: rule.searchList,
    searchName: rule.searchName,
    searchResult: rule.searchResult,
    chapterRoads: rule.chapterRoads,
    chapterResult: rule.chapterResult,
    referer: rule.referer,
    antiCrawlerConfig: rule.antiCrawlerConfig,
  };
}

/** 创建空白模板规则，供编辑器或测试使用 */
export function createEmptyPluginRule(): PluginRule {
  return {
    api: '1',
    type: 'anime',
    name: '',
    version: '',
    muliSources: true,
    useWebview: true,
    useNativePlayer: true,
    usePost: false,
    useLegacyParser: false,
    adBlocker: false,
    userAgent: '',
    baseUrl: '',
    searchURL: '',
    searchList: '',
    searchName: '',
    searchResult: '',
    chapterRoads: '',
    chapterResult: '',
    referer: '',
    antiCrawlerConfig: emptyAntiCrawlerConfig(),
  };
}
