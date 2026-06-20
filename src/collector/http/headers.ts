/**
 * 插件 HTTP 请求头构建，模拟浏览器常见指纹。
 *
 * 对应 Kazumi `lib/utils/http_headers.dart` + `Plugin.buildHttpHeaders`。
 */

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
];

const ACCEPT_LANGUAGES = [
  'zh-CN,zh;q=0.9,en;q=0.8',
  'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
  'en-US,en;q=0.9,zh-CN;q=0.8',
];

export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] ?? USER_AGENTS[0];
}

export function getRandomAcceptedLanguage(): string {
  return (
    ACCEPT_LANGUAGES[Math.floor(Math.random() * ACCEPT_LANGUAGES.length)] ??
    ACCEPT_LANGUAGES[0]
  );
}

/** buildPluginHttpHeaders 的可选入参 */
export type BuildPluginHttpHeadersOptions = {
  /** 指定 UA；空或未传时使用随机 UA */
  userAgent?: string;
  /** Referer 请求头 */
  referer?: string;
  /** Cookie 请求头（通常由 CookieStore.getCookieHeader 生成） */
  cookie?: string;
  /** 额外请求头，会覆盖同名字段 */
  extra?: Record<string, string>;
};

/** 构建插件请求头；规则未指定 userAgent 时使用随机 UA */
export function buildPluginHttpHeaders(
  options?: BuildPluginHttpHeadersOptions,
): Record<string, string> {
  const headers: Record<string, string> = {
    'user-agent': options?.userAgent?.trim() || getRandomUserAgent(),
    'Accept-Language': getRandomAcceptedLanguage(),
    Connection: 'keep-alive',
  };
  if (options?.referer) {
    headers.referer = options.referer;
  }
  if (options?.cookie) {
    headers.Cookie = options.cookie;
  }
  if (options?.extra) {
    Object.assign(headers, options.extra);
  }
  return headers;
}
