/**
 * 播放线路，对应 Kazumi `Road`。
 *
 * data 与 identifier 数组一一对应：同一索引表示同一集的 URL 与显示名。
 */
export type Road = {
  /** 线路显示名，如「播放线路1」 */
  name: string;
  /** 各集播放页 URL（相对或绝对），由 chapterResult XPath 提取 href */
  data: string[];
  /** 各集显示名称（已去除空白），与 data 索引对齐 */
  identifier: string[];
};
