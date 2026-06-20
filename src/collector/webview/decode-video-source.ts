/**
 * 视频 URL 解码与过滤工具。
 *
 * Legacy 模式下 iframe src 常将真实 m3u8 藏在 query 参数中，需额外解码。
 */
/** 从 iframe URL 的 query 参数中提取 m3u8 / mp4 地址（Legacy 模式） */
export function decodeVideoSource(iframeUrl: string): string {
  const decodedUrl = decodeURIComponent(iframeUrl);
  const regExp = /(https?:\/\/.*?\.m3u8)|(https?:\/\/.*?\.mp4)/i;

  try {
    const uri = new URL(decodedUrl);
    let matchedUrl = iframeUrl;
    for (const value of uri.searchParams.values()) {
      if (regExp.test(value)) {
        matchedUrl = value;
        break;
      }
    }
    return encodeURI(matchedUrl);
  } catch {
    return iframeUrl;
  }
}

/** 过滤常见广告域名请求 */
export function isAdUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('googleads') ||
    lower.includes('googlesyndication') ||
    lower.includes('adtrafficquality') ||
    lower.includes('doubleclick')
  );
}

export function isM3u8Url(url: string): boolean {
  try {
    const uri = new URL(url);
    return uri.pathname.toLowerCase().endsWith('.m3u8');
  } catch {
    return url.toLowerCase().includes('.m3u8');
  }
}
