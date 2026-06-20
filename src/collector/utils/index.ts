import URLParse from 'url-parse';
import {
  buildPrefixMirrorTransforms,
  getGitHubMirrorPrefixMirrors,
} from './githubMirrorConfig';

/** GitHub 资源 host：raw 直链与 blob 页域名 */
const GITHUB_HOST_REGEX = /^(?:raw\.githubusercontent\.com|github\.com)$/i;


/**
 * 并发测速，返回最快可访问的 URL
 */
async function electFastest(urls: string[]): Promise<string | null> {
  const controller = new AbortController();

  const testUrl = async (u: string) => {
    const start = performance.now();
    try {
      const res = await fetch(u, { method: "HEAD", signal: controller.signal });
      if (res.ok) {
        controller.abort(); // 中断其他请求
        return { url: u, time: performance.now() - start };
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        // 忽略非取消错误
      }
    }
    return null;
  };

  // 尝试快速获取第一个成功的结果
  try {
    const raceResult = await Promise.race(urls.map(u => testUrl(u)));
    if (raceResult) return raceResult.url;
  } catch {
    // 忽略错误
  }

  // 如果快速模式失败，等待所有完成并选择最快的
  const results = await Promise.allSettled(urls.map(u => testUrl(u)));
  const valid = results
    .filter((r): r is PromiseFulfilledResult<{ url: string; time: number } | null> => 
      r.status === 'fulfilled' && r.value !== null
    )
    .map(r => r.value!)
    .sort((a, b) => a.time - b.time);

  return valid[0]?.url || null;
}

export const getFastestURL = async (url: string): Promise<string> => {
  if (!url) return url;

  const urlObj = URLParse(url, true);
  
  // 如果是GitHub资源，尝试多个镜像加速
  if (!GITHUB_HOST_REGEX.test(urlObj.host)) return url;

  const mirrors = [
    ...buildPrefixMirrorTransforms(getGitHubMirrorPrefixMirrors().prefixes),
    (u: string) => u, // 原始地址作为兜底
  ];

  try {
    const fastest = await electFastest(mirrors.map(fn => fn(url)));
    return fastest || url;
  } catch (e) {
    console.warn("获取最快URL失败，回退原始:", e);
    return url;
  }
};