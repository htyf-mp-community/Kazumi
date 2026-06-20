/**
 * 采集器专用错误类型，与 Kazumi `lib/plugins/plugins.dart` 异常语义对齐。
 * UI 层可通过 `error.name` 或 `instanceof` 区分处理分支。
 */

/** 搜索响应命中验证页，需用户通过 WebView 完成验证后重试 */
export class CaptchaRequiredError extends Error {
  /** 需要验证的插件规则 name */
  readonly pluginName: string;

  constructor(pluginName: string) {
    super(`CaptchaRequiredError: ${pluginName} requires captcha verification`);
    this.name = 'CaptchaRequiredError';
    this.pluginName = pluginName;
  }
}

/** XPath 解析完成但 searchList 结果为空 */
export class NoResultError extends Error {
  /** 无结果的插件规则 name */
  readonly pluginName: string;

  constructor(pluginName: string) {
    super(`NoResultError: ${pluginName} returned no search results`);
    this.name = 'NoResultError';
    this.pluginName = pluginName;
  }
}

/** 网络失败、HTTP 非 2xx 等搜索异常（shouldRethrow 为 true 时由 SearchStage 抛出） */
export class SearchError extends Error {
  /** 搜索失败的插件规则 name；aborted 时为 `'unknown'` */
  readonly pluginName: string;
  /** 原始错误对象 */
  readonly cause?: unknown;

  constructor(pluginName: string, cause?: unknown) {
    super(
      `SearchError: ${pluginName} search failed${cause != null ? ` (${String(cause)})` : ''}`,
    );
    this.name = 'SearchError';
    this.pluginName = pluginName;
    this.cause = cause;
  }
}

/** WebView 加载失败，或页面加载完成但未嗅探到有效 m3u8/mp4 */
export class VideoSourceNotFoundError extends Error {
  constructor(message = 'Video source not found') {
    super(message);
    this.name = 'VideoSourceNotFoundError';
  }
}

/** 嗅探超过 timeoutMs 仍未获得视频地址 */
export class VideoSourceTimeoutError extends Error {
  /** 触发超时的时间阈值（毫秒） */
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`VideoSourceTimeoutError: Timed out after ${timeoutMs}ms`);
    this.name = 'VideoSourceTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/** 新的 resolve 覆盖了进行中的嗅探，或主动调用 VideoSniffer.cancel() */
export class VideoSourceCancelledError extends Error {
  constructor() {
    super('VideoSourceCancelledError: Resolution was cancelled');
    this.name = 'VideoSourceCancelledError';
  }
}
