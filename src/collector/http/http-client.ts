/**
 * 插件 HTTP 客户端，基于 fetch 封装 GET / POST form。
 *
 * 所有请求自动附加随机 UA、Accept-Language 等头（见 headers.ts）。
 */
import { buildPluginHttpHeaders } from './headers';

/** HTTP 文本响应 */
export type HttpTextResponse = {
  /** 响应体文本（通常为 HTML） */
  text: string;
  /** HTTP 状态码，非 2xx 时 getText/postFormText 会抛错 */
  status: number;
};

export class HttpClient {
  async getText(
    url: string,
    headers: Record<string, string> = {},
  ): Promise<HttpTextResponse> {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildPluginHttpHeaders({ extra: headers }),
    });
    const text = await response.text();
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return { text, status: response.status };
  }

  async postFormText(
    url: string,
    data: Record<string, string>,
    headers: Record<string, string> = {},
  ): Promise<HttpTextResponse> {
    const body = new URLSearchParams(data).toString();
    const response = await fetch(url, {
      method: 'POST',
      headers: buildPluginHttpHeaders({
        extra: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...headers,
        },
      }),
      body,
    });
    const text = await response.text();
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return { text, status: response.status };
  }
}

export const defaultHttpClient = new HttpClient();
