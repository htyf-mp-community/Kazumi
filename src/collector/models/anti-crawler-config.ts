/**
 * 反反爬虫配置，与 Kazumi `lib/plugins/anti_crawler_config.dart` 对齐。
 *
 * 搜索响应命中验证页时，需通过 WebView 完成验证并将 Cookie 写入 CookieStore，
 * 后续 HTTP 请求自动携带；Cookie 仅当前 App 会话有效。
 */
export const CaptchaType = {
  /** 图片验证码：WebView 抓取验证码图，用户手动输入后提交 */
  imageCaptcha: 1,
  /** 自动点击：检测到验证按钮后自动模拟点击（如「我不是机器人」） */
  autoClickButton: 2,
  /** 自定义 JS：注入 captchaScript，由脚本完成验证流程 */
  customJavaScript: 3,
} as const;

export const CaptchaDetectType = {
  /** 用 XPath 判断验证页元素是否存在 */
  xpath: 1,
  /** 响应 HTML 包含指定文本即视为验证页 */
  text: 2,
  /** 响应 HTML 匹配指定正则即视为验证页 */
  regex: 3,
} as const;

/** 规则 JSON 中 antiCrawlerConfig 字段的结构 */
export type AntiCrawlerConfig = {
  /** 是否启用反反爬虫；false 时不检测验证页 */
  enabled: boolean;
  /** 验证方式，见 {@link CaptchaType} */
  captchaType: number;
  /** 验证码图片元素 XPath，captchaType=1 时用于 WebView 定位并抓取图片 */
  captchaImage: string;
  /** 验证码输入框 XPath，captchaType=1 时用于模拟输入 */
  captchaInput: string;
  /**
   * 验证按钮 XPath。
   * captchaType=1：提交验证码的按钮；captchaType=2：自动点击的目标按钮。
   */
  captchaButton: string;
  /** 验证页检测方式，见 {@link CaptchaDetectType} */
  captchaDetectType: number;
  /**
   * 验证页检测内容，语义取决于 captchaDetectType：
   * xpath → XPath 表达式；text → 包含文本；regex → 正则表达式。
   * 为空时 fallback 到 captchaImage / captchaButton 的 XPath。
   */
  captchaDetectValue: string;
  /** 自定义验证 JS 脚本，captchaType=3 时注入 WebView 执行 */
  captchaScript: string;
};

/** 返回 enabled=false 的默认配置 */
export function emptyAntiCrawlerConfig(): AntiCrawlerConfig {
  return {
    enabled: false,
    captchaType: CaptchaType.imageCaptcha,
    captchaImage: '',
    captchaInput: '',
    captchaButton: '',
    captchaDetectType: CaptchaDetectType.xpath,
    captchaDetectValue: '',
    captchaScript: '',
  };
}

/** 从规则 JSON 的 antiCrawlerConfig 字段解析，缺失时返回 emptyAntiCrawlerConfig() */
export function parseAntiCrawlerConfig(
  json: Record<string, unknown> | undefined,
): AntiCrawlerConfig {
  if (!json) {
    return emptyAntiCrawlerConfig();
  }
  return {
    enabled: Boolean(json.enabled),
    captchaType: Number(json.captchaType ?? CaptchaType.imageCaptcha),
    captchaImage: String(json.captchaImage ?? ''),
    captchaInput: String(json.captchaInput ?? ''),
    captchaButton: String(json.captchaButton ?? ''),
    captchaDetectType: Number(
      json.captchaDetectType ?? CaptchaDetectType.xpath,
    ),
    captchaDetectValue: String(json.captchaDetectValue ?? ''),
    captchaScript: String(json.captchaScript ?? ''),
  };
}
