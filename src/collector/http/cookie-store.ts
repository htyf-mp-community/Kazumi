/**
 * 每条规则独立的 Cookie 内存存储。
 *
 * 对应 Kazumi `PluginCookieManager`：验证码 WebView 验证通过后写入，
 * 后续 SearchStage HTTP 请求自动携带。仅当前 App 会话有效，重启后需重新验证。
 */
export class CookieStore {
  /** pluginName → host:name → value */
  private readonly jars = new Map<string, Map<string, string>>();

  hasCookies(pluginName: string): boolean {
    const jar = this.jars.get(pluginName);
    return !!jar && jar.size > 0;
  }

  clear(pluginName: string): void {
    this.jars.delete(pluginName);
  }

  /** 解析 WebView document.cookie 字符串并写入对应规则的 jar */
  saveFromDocumentCookie(
    pluginName: string,
    pageUrl: string,
    cookieString: string,
  ): void {
    const trimmed = cookieString.trim();
    if (!trimmed) {
      return;
    }
    const uri = new URL(pageUrl);
    const jar = this.jars.get(pluginName) ?? new Map<string, string>();
    for (const part of trimmed.split(';')) {
      const piece = part.trim();
      if (!piece) {
        continue;
      }
      const eqIndex = piece.indexOf('=');
      if (eqIndex <= 0) {
        continue;
      }
      const name = piece.slice(0, eqIndex).trim();
      const value = piece.slice(eqIndex + 1).trim();
      jar.set(`${uri.host}:${name}`, value);
    }
    this.jars.set(pluginName, jar);
  }

  /** 按目标 URL 的 host 筛选并拼接 Cookie 请求头 */
  getCookieHeader(pluginName: string, url: string): string {
    const jar = this.jars.get(pluginName);
    if (!jar || jar.size === 0) {
      return '';
    }
    let host = '';
    try {
      host = new URL(url).host;
    } catch {
      return '';
    }
    const pairs: string[] = [];
    for (const [key, value] of jar.entries()) {
      const [cookieHost, name] = key.split(':');
      if (cookieHost === host) {
        pairs.push(`${name}=${value}`);
      }
    }
    return pairs.join('; ');
  }
}

export const globalCookieStore = new CookieStore();
