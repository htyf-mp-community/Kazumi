/**
 * 视频源类型。
 * - `online`：WebView 嗅探得到的在线流地址
 * - `cached`：本地缓存（预留，当前未使用）
 */
export type VideoSourceType = 'online' | 'cached';

/** WebView 嗅探到的可播放地址，对应 Kazumi 播放器入参 */
export type VideoSource = {
  /** m3u8 / mp4 等可直接交给播放器的 URL */
  url: string;
  /**
   * 同页多视频源时的选取偏移。
   * muliSources 规则下，offset 用于跳过前 N 个候选源。
   */
  offset: number;
  /** 视频源类型，嗅探结果固定为 `online` */
  type: VideoSourceType;
};

/** 传给 VideoSniffer.resolve 的可选参数，未指定时使用规则默认值 */
export type ResolveVideoOptions = {
  /** 覆盖规则的 useLegacyParser，决定 iframe / 现代嗅探模式 */
  useLegacyParser?: boolean;
  /** 同页多源偏移，默认 0 */
  offset?: number;
  /** 嗅探超时毫秒数，默认 DEFAULT_RESOLVE_TIMEOUT_MS */
  timeoutMs?: number;
  /** 覆盖 referer 请求头，默认取 rule.referer || rule.baseUrl */
  referer?: string;
  /** 覆盖 WebView userAgent，空则使用 WebView 默认值 */
  userAgent?: string;
};
