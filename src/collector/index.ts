/**
 * Kazumi 采集器（React Native 移植版）
 *
 * 与 Flutter 版 `lib/plugins` + `lib/services/plugin` 对齐，负责：
 * 1. 按插件规则 HTTP 搜索番剧（SearchStage）
 * 2. 解析详情页播放线路（RoadStage）
 * 3. WebView 嗅探真实视频地址（VideoSnifferHost）
 * 4. 反爬验证码检测与 Cookie 复用（captcha-detector + CookieStore）
 *
 * 典型用法：
 * ```tsx
 * <CollectorProvider>
 *   <App />  // 内部通过 useCollector().getRuleEngine() 调用
 * </CollectorProvider>
 * ```
 */

export { PLUGIN_API_LEVEL, DEFAULT_RESOLVE_TIMEOUT_MS } from './constants';

export * from './models/errors';
export * from './models/anti-crawler-config';
export * from './models/plugin-rule';
export * from './models/search-item';
export * from './models/road';
export * from './models/video-source';

export { CookieStore, globalCookieStore } from './http/cookie-store';
export { HttpClient, defaultHttpClient } from './http/http-client';
export { buildPluginHttpHeaders, getRandomUserAgent, type BuildPluginHttpHeadersOptions } from './http/headers';

export {
  parseHtmlDocument,
  queryXPathList,
  queryXPathNodes,
} from './parse/xpath-html-parser';

export { detectsCaptchaChallenge } from './anti-crawler/captcha-detector';

export { SearchStage, defaultSearchStage } from './engine/search-stage';
export { RoadStage, defaultRoadStage } from './engine/road-stage';
export {
  RuleEngine,
  createRuleEngine,
  type SearchAllResult,
} from './engine/rule-engine';

export { decodeVideoSource, isAdUrl, isM3u8Url } from './webview/decode-video-source';
export type { VideoSniffer } from './webview/video-sniffer-types';
export {
  VideoSnifferHost,
  type VideoSnifferHostRef,
} from './webview';

export {
  BUILTIN_PLUGINS,
  BUILTIN_AGE,
  BUILTIN_DM84,
  BUILTIN_ENLIE,
  parsePluginList,
} from './plugins/builtin-plugins';

export {
  buildKazumiRuleUrl,
  DEFAULT_RULE_URL,
  fetchKazumiPluginList,
  fetchPluginRuleFromUrl,
  KAZUMI_RULES_INDEX_URL,
  normalizeRuleUrl,
  type KazumiPluginListItem,
} from './plugins/fetch-plugin-rule';

export {
  CollectorProvider,
  useCollector,
  type CollectorContextValue,
} from './CollectorProvider';
