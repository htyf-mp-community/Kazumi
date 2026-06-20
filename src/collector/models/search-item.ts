/** 单条搜索结果，对应 Kazumi `SearchItem` */
export type SearchItem = {
  /** 番剧标题，由 searchName XPath 从列表项中提取 */
  name: string;
  /** 详情页路径（href），由 searchResult XPath 提取；可为相对路径 */
  src: string;
};

/** 某个插件的完整搜索响应，对应 Kazumi `PluginSearchResponse` */
export type PluginSearchResponse = {
  /** 产生该结果的插件规则 name */
  pluginName: string;
  /** 匹配到的搜索结果列表，空数组时 SearchStage 会抛出 NoResultError */
  data: SearchItem[];
};
