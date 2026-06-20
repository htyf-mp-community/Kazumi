/**
 * 远程规则加载：从 URL 或 KazumiRules 聚合列表 fetch 插件 JSON。
 *
 * 流程：normalizeRuleUrl → getFastestURL（GitHub 镜像竞速）→ fetch。
 * 支持 GitHub blob → raw 自动转换，以及 gh-proxy.org 前缀剥离。
 */
import { parsePluginRule, type PluginRule } from '../models/plugin-rule';
import { getFastestURL } from '../utils';

const GITHUB_BLOB_PATTERN =
  /^(https?:\/\/(?:[^/]+\/)*?)github\.com(\/[^/]+\/[^/]+)\/blob(\/.+)$/i;

/** 将 GitHub blob 链接转为 raw 链接，便于直接 fetch JSON */
export function normalizeRuleUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return trimmed;
  }

  const ghProxyMatch = trimmed.match(
    /^https?:\/\/gh-proxy\.org\/(https?:\/\/.+)$/i,
  );
  if (ghProxyMatch) {
    return normalizeRuleUrl(ghProxyMatch[1]);
  }

  const blobMatch = trimmed.match(GITHUB_BLOB_PATTERN);
  if (blobMatch) {
    const prefix = blobMatch[1] ?? 'https://';
    const repo = blobMatch[2] ?? '';
    const path = blobMatch[3] ?? '';
    return `${prefix}raw.githubusercontent.com${repo}${path}`;
  }

  return trimmed;
}

/** normalize 后竞速选取可访问的 GitHub 镜像 URL */
async function resolveRuleFetchUrl(url: string): Promise<string> {
  const normalized = normalizeRuleUrl(url);
  if (!normalized) {
    return normalized;
  }
  return getFastestURL(normalized);
}

/** 从 URL 拉取并解析单条插件规则 JSON */
export async function fetchPluginRuleFromUrl(url: string): Promise<PluginRule> {
  const fetchUrl = await resolveRuleFetchUrl(url);
  if (!fetchUrl) {
    throw new Error('规则 URL 不能为空');
  }

  const response = await fetch(fetchUrl, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`加载规则失败: HTTP ${response.status}`);
  }

  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('规则 JSON 解析失败');
  }

  if (!json || typeof json !== 'object') {
    throw new Error('规则格式无效');
  }

  const rule = parsePluginRule(json as Record<string, unknown>);
  if (!rule.name.trim()) {
    throw new Error('规则缺少 name 字段');
  }
  return rule;
}

/** KazumiRules index.json 中的单条插件元信息，对应 Kazumi `PluginHTTPItem` */
export type KazumiPluginListItem = {
  /** 插件规则 name，可用于 buildKazumiRuleUrl 拼出 JSON 地址 */
  name: string;
  /** 规则版本号 */
  version: string;
  /** 是否支持原生播放器 */
  useNativePlayer: boolean;
  /** 是否启用了 antiCrawlerConfig.enabled */
  antiCrawlerEnabled: boolean;
  /** 规则作者 */
  author: string;
  /** 最后更新时间戳（Unix 秒或毫秒，取决于 index.json） */
  lastUpdate: number;
};

/** KazumiRules 聚合列表默认地址（经 gh-proxy 加速） */
export const KAZUMI_RULES_INDEX_URL =
  'https://github.com/Predidit/KazumiRules/blob/main/index.json';

/** 根据聚合列表中的 name 拼出 KazumiRules 规则 JSON 的 GitHub blob 地址 */
export function buildKazumiRuleUrl(pluginName: string): string {
  const name = pluginName.trim();
  if (!name) {
    return '';
  }
  return `https://github.com/Predidit/KazumiRules/blob/main/${encodeURIComponent(name)}.json`;
}

/** 拉取 KazumiRules 插件聚合列表 */
export async function fetchKazumiPluginList(
  indexUrl: string = KAZUMI_RULES_INDEX_URL,
): Promise<KazumiPluginListItem[]> {
  const fetchUrl = await resolveRuleFetchUrl(indexUrl);
  if (!fetchUrl) {
    throw new Error('聚合列表 URL 不能为空');
  }

  const response = await fetch(fetchUrl, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`加载聚合列表失败: HTTP ${response.status}`);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new Error('聚合列表 JSON 解析失败');
  }

  if (!Array.isArray(json)) {
    throw new Error('聚合列表格式无效');
  }

  return json
    .filter(
      (item): item is KazumiPluginListItem =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as KazumiPluginListItem).name === 'string' &&
        (item as KazumiPluginListItem).name.trim().length > 0,
    )
    .map((item) => ({
      ...item,
      name: item.name.trim(),
    }));
}

/** 默认测试规则（xfdmneo）的 URL */
export const DEFAULT_RULE_URL = buildKazumiRuleUrl('xfdmneo');
