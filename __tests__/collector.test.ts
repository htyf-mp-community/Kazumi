import { decodeVideoSource, isAdUrl, isM3u8Url } from '@/collector';

describe('decodeVideoSource', () => {
  it('extracts m3u8 from iframe query params', () => {
    const iframe =
      'https://player.example.com/embed?url=https%3A%2F%2Fcdn.example.com%2Fvideo.m3u8';
    expect(decodeVideoSource(iframe)).toContain('video.m3u8');
  });
});

describe('url helpers', () => {
  it('detects ad urls', () => {
    expect(isAdUrl('https://googleads.example.com/x')).toBe(true);
    expect(isAdUrl('https://cdn.example.com/x.m3u8')).toBe(false);
  });

  it('detects m3u8 urls', () => {
    expect(isM3u8Url('https://cdn.example.com/play.m3u8?token=1')).toBe(true);
    expect(isM3u8Url('https://cdn.example.com/play.mp4')).toBe(false);
  });
});
