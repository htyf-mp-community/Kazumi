/**
 * 内置插件规则（硬编码），便于离线调试与默认源。
 *
 * 完整规则库见 KazumiRules 仓库，运行时通过 fetch-plugin-rule 拉取。
 */
import { parsePluginRule, type PluginRule } from '../models/plugin-rule';

export const BUILTIN_AGE: PluginRule = parsePluginRule({
  api: '1',
  type: 'anime',
  name: 'AGE',
  version: '1.5',
  muliSources: true,
  useWebview: true,
  useNativePlayer: true,
  userAgent: '',
  baseURL: 'https://www.agedm.io/',
  searchURL: 'https://www.agedm.io/search?query=@keyword',
  searchList: '//div[2]/div/section/div/div/div/div',
  searchName: '//div/div[2]/h5/a',
  searchResult: '//div/div[2]/h5/a',
  chapterRoads: '//div[2]/div/section/div/div[2]/div[2]/div[2]/div',
  chapterResult: '//ul/li/a',
});

export const BUILTIN_DM84: PluginRule = parsePluginRule({
  api: '5',
  type: 'anime',
  name: 'DM84',
  version: '1.4',
  muliSources: true,
  useWebview: true,
  useNativePlayer: true,
  adBlocker: true,
  userAgent: '',
  baseURL: 'https://dmbus.cc/',
  searchURL: 'https://dmbus.cc/s----------.html?wd=@keyword',
  searchList: '//div/div[3]/ul/li',
  searchName: '//div/a[2]',
  searchResult: '//div/a[2]',
  chapterRoads: '//div/div[4]/div/ul',
  chapterResult: '//li/a',
});

export const BUILTIN_ENLIE: PluginRule = parsePluginRule({
  api: '5',
  type: 'anime',
  name: 'enlie',
  version: '1.0',
  muliSources: true,
  useWebview: true,
  useNativePlayer: true,
  useLegacyParser: false,
  adBlocker: true,
  userAgent: '',
  baseURL: 'https://enlienli.link/',
  searchURL: 'https://enlienli.link/vod/search.html?wd=@keyword',
  searchList: '//div[1]/div[2]/div/div/div[2]/div/div',
  searchName: '//div[2]/div[1]/a',
  searchResult: '//div[2]/div[1]/a',
  chapterRoads: '//div/div[2]/div/div[2]/div/div/div',
  chapterResult: '//a',
  referer: '',
});

export const BUILTIN_PLUGINS: PluginRule[] = [
  BUILTIN_AGE,
  BUILTIN_DM84,
  BUILTIN_ENLIE,
];

/** 从 JSON 数组批量解析规则 */
export function parsePluginList(json: unknown): PluginRule[] {
  if (!Array.isArray(json)) {
    return [];
  }
  return json.map((item) => parsePluginRule(item as Record<string, unknown>));
}
