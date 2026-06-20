import { parseBangumiItem, type BangumiItem } from '@/types/bangumi';

const BANGUMI_NEXT = [
  'https://next.bangumi.one',
  'https://next.bgm.tv',
];
const BANGUMI_V0 = [
  'https://api.bangumi.one/v0',
  'https://api.bgm.tv/v0',
];

const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Predidit/Kazumi/2.1.6 (Android) (https://github.com/Predidit/Kazumi)',
};

/**
 * 从镜像列表中获取数据
 * @param bases 镜像列表
 * @param path 路径
 * @param init 请求头
 * @returns 
 */
async function fetchFromMirrors(
  bases: readonly string[],
  path: string,
  init?: RequestInit,
): Promise<Response> {
  let lastError: Error | null = null;
  for (const base of bases) {
    const url = `${base.replace(/\/+$/, '')}${path}`;
    try {
      const response = await fetch(url, init);
      if (response.ok) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error('所有 Bangumi 镜像均不可用');
}
/**
 * 获取热门番剧
 * @param offset 偏移量
 * @param limit 每页条数
 * @param type 类型
 * @returns 热门番剧
 */
export async function fetchTrendingSubjects(
  offset = 0,
  limit = 24,
  type = 2,
): Promise<BangumiItem[]> {
  const response = await fetchFromMirrors(
    BANGUMI_NEXT,
    `/p1/trending/subjects?type=${type}&limit=${limit}&offset=${offset}`,
    { headers: DEFAULT_HEADERS },
  );
  const json = (await response.json()) as { data?: Array<{ subject?: Record<string, unknown> }> };
  console.log(json.data)
  return (json.data ?? [])
    .map((entry) => entry.subject)
    .filter((item): item is Record<string, unknown> => !!item)
    .map(parseBangumiItem)
    .filter((item) => item.id > 0);
}
/**
 * 获取每日放送
 * @returns 每日放送
 */
export async function fetchCalendar(): Promise<BangumiItem[][]> {
  const response = await fetchFromMirrors(BANGUMI_NEXT, '/p1/calendar', {
    headers: DEFAULT_HEADERS,
  });
  const json = (await response.json()) as Record<string, Array<{ subject?: Record<string, unknown> }>>;
  const calendar: BangumiItem[][] = [];
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    const dayList = json[String(weekday)] ?? [];
    calendar.push(
      dayList
        .map((entry) => entry.subject)
        .filter((item): item is Record<string, unknown> => !!item)
        .map(parseBangumiItem)
        .filter((item) => item.id > 0),
    );
  }
  return calendar;
}
/**
 * 搜索番剧
 * @param keyword 搜索关键词
 * @param offset 偏移量
 * @param limit 每页条数
 * @returns 搜索结果
 */
export async function searchBangumiSubjects(
  keyword: string,
  offset = 0,
  limit = 20,
): Promise<BangumiItem[]> {
  const trimmed = keyword.trim();
  if (!trimmed) {
    return [];
  }
  const response = await fetchFromMirrors(
    BANGUMI_V0,
    `/search/subjects?type=2&limit=${limit}&offset=${offset}`,
    {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ keyword: trimmed }),
    },
  );
  const json = (await response.json()) as {
    data?: Array<Record<string, unknown>>;
  };
  return (json.data ?? []).map(parseBangumiItem).filter((item) => item.id > 0);
}
/**
 * 获取番剧详情
 * @param id 番剧ID
 * @returns 番剧详情
 */
export async function fetchBangumiSubject(id: number): Promise<BangumiItem> {
  const response = await fetchFromMirrors(BANGUMI_NEXT, `/p1/subjects/${id}`, {
    headers: DEFAULT_HEADERS,
  });
  const json = (await response.json()) as Record<string, unknown>;
  return parseBangumiItem(json);
}
