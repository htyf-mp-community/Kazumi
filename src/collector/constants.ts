/** 与 Kazumi `ApiEndpoints.apiLevel` 对齐，用于判断规则是否兼容当前客户端 */
export const PLUGIN_API_LEVEL = 7;

/** 搜索/详情请求默认附加的 HTTP 头 */
export const DEFAULT_SEARCH_HEADERS = {
  Connection: 'keep-alive',
} as const;

/** WebView 嗅探视频地址的默认超时（毫秒） */
export const DEFAULT_RESOLVE_TIMEOUT_MS = 30_000;
