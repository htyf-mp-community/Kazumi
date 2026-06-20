/**
 * 线路阶段：拉取详情页 HTML 并解析播放线路与集数列表。
 *
 * 对应 Kazumi `Plugin.querychapterRoads`。
 */
import type { HttpClient } from '../http/http-client';
import { defaultHttpClient } from '../http/http-client';
import type { PluginRule } from '../models/plugin-rule';
import type { Road } from '../models/road';
import {
  parseHtmlDocument,
  queryXPathNodes,
} from '../parse/xpath-html-parser';

export class RoadStage {
  constructor(private readonly http: HttpClient = defaultHttpClient) {}

  /** 拉取详情页并解析所有播放线路，失败时返回空数组 */
  async fetchRoads(
    rule: PluginRule,
    url: string,
    signal?: AbortSignal,
  ): Promise<Road[]> {
    if (signal?.aborted) {
      return [];
    }

    let normalizedUrl = url;
    if (!normalizedUrl.includes('https')) {
      normalizedUrl = normalizedUrl.replace('http', 'https');
    }

    let queryURL = normalizedUrl;
    if (!normalizedUrl.includes(rule.baseUrl)) {
      queryURL = rule.baseUrl + normalizedUrl;
    }

    const referer = `${rule.baseUrl.replace(/\/$/, '')}/`;

    try {
      const htmlString = (
        await this.http.getText(queryURL, { referer })
      ).text;
      if (signal?.aborted) {
        return [];
      }
      return this.parseRoadHtml(rule, htmlString);
    } catch {
      return [];
    }
  }

  parseRoadHtml(rule: PluginRule, htmlString: string): Road[] {
    const document = parseHtmlDocument(htmlString);
    const roadList: Road[] = [];
    let count = 1;
    for (const element of queryXPathNodes(document, rule.chapterRoads)) {
      try {
        const chapterUrlList: string[] = [];
        const chapterNameList: string[] = [];

        for (const item of queryXPathNodes(element, rule.chapterResult)) {
          const el = item as Element & { getAttribute?: (n: string) => string | null };
          const itemUrl = el.getAttribute?.('href') ?? '';
          const itemName = (el.textContent ?? '').replace(/\s+/g, '');
          if (itemUrl) {
            chapterUrlList.push(itemUrl);
          }
          if (itemName) {
            chapterNameList.push(itemName);
          }
        }

        if (chapterUrlList.length > 0 && chapterNameList.length > 0) {
          roadList.push({
            name: `播放线路${count}`,
            data: chapterUrlList,
            identifier: chapterNameList,
          });
          count += 1;
        }
      } catch {
        // 单条线路失败跳过，与 Kazumi 一致
      }
    }

    return roadList;
  }

  /** 将相对路径补全为绝对 URL */
  buildFullUrl(rule: PluginRule, urlItem: string): string {
    if (
      urlItem.includes(rule.baseUrl) ||
      urlItem.includes(rule.baseUrl.replace('https', 'http'))
    ) {
      return urlItem;
    }
    return rule.baseUrl + urlItem;
  }
}

export const defaultRoadStage = new RoadStage();
