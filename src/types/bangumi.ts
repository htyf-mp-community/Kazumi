/** 与 Kazumi `BangumiItem` 对齐的核心字段 */
export type BangumiItem = {
  id: number;
  type: number;
  name: string;
  nameCn: string;
  summary: string;
  airDate: string;
  airWeekday: number;
  rank: number;
  images: Record<string, string>;
  tags: Array<{ name: string }>;
  ratingScore: number;
};

/** 收藏类型，见 Kazumi `CollectType` */
export const CollectType = {
  none: 0,
  watching: 1,
  planToWatch: 2,
  onHold: 3,
  watched: 4,
  abandoned: 5,
} as const;

export type CollectTypeValue = (typeof CollectType)[keyof typeof CollectType];

export const COLLECT_TAB_LABELS = ['在看', '想看', '搁置', '看过', '抛弃'] as const;

export const COLLECT_TAB_TYPES: CollectTypeValue[] = [
  CollectType.watching,
  CollectType.planToWatch,
  CollectType.onHold,
  CollectType.watched,
  CollectType.abandoned,
];

export type CollectedBangumi = {
  bangumi: BangumiItem;
  type: CollectTypeValue;
  updatedAt: number;
};

export type WatchHistoryItem = {
  id: string;
  bangumi: BangumiItem;
  pluginName: string;
  episodeIndex: number;
  roadIndex: number;
  episodeName: string;
  episodeHref: string;
  progressMs: number;
  lastWatchTime: number;
};

function extractNameCnFromInfobox(json: Record<string, unknown>): string {
  const infobox = json.infobox;
  if (!Array.isArray(infobox)) {
    return '';
  }
  for (const item of infobox) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const entry = item as Record<string, unknown>;
    const key = String(entry.key ?? '');
    if (key !== '中文名' && key !== '简体中文名' && key !== '港台译名') {
      continue;
    }
    const raw = entry.values ?? entry.value;
    if (Array.isArray(raw) && raw.length > 0) {
      const first = raw[0];
      if (first && typeof first === 'object' && 'v' in first) {
        return String((first as Record<string, unknown>).v ?? '').trim();
      }
      return String(first).trim();
    }
    if (raw != null) {
      return String(raw).trim();
    }
  }
  return '';
}

function resolveNameCn(json: Record<string, unknown>): string {
  const fromField = String(json.name_cn ?? json.nameCn ?? json.nameCN ?? '').trim();
  if (fromField) {
    return fromField;
  }
  return extractNameCnFromInfobox(json);
}
export function parseBangumiItem(json: Record<string, unknown>): BangumiItem {
  const rating = json.rating as Record<string, unknown> | undefined;
  const images = (json.images as Record<string, string>) ?? {};
  const tagsRaw = json.tags;
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw
        .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
        .map((t) => ({ name: String(t.name ?? '') }))
        .filter((t) => t.name)
    : [];

  return {
    id: Number(json.id ?? 0),
    type: Number(json.type ?? 2),
    name: String(json.name ?? ''),
    nameCn: resolveNameCn(json),
    summary: String(json.summary ?? ''),
    airDate: String(json.date ?? json.air_date ?? json.airDate ?? ''),
    airWeekday: Number(json.air_weekday ?? json.airWeekday ?? 0),
    rank: Number(json.rank ?? 0),
    images,
    tags,
    ratingScore: Number(rating?.score ?? json.ratingScore ?? 0),
  };
}

export function getBangumiCover(item: BangumiItem): string {
  return (
    item.images.large ??
    item.images.common ??
    item.images.medium ??
    item.images.grid ??
    item.images.small ??
    ''
  );
}

export function getDisplayName(item: BangumiItem): string {
  return item.nameCn.trim() || item.name.trim() || '未知番剧';
}

export function getSecondaryName(item: BangumiItem): string | null {
  const primary = item.nameCn.trim();
  const original = item.name.trim();
  if (primary && original && primary !== original) {
    return original;
  }
  return null;
}
