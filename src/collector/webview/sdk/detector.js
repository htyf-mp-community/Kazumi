/**
 * @fileoverview Kazumi Inspector Detector — 视频 URL / MIME / 内容检测（纯函数，无副作用）。
 * @module detector
 */

(function initKazumiDetector(global) {
  'use strict';

  var INSPECTOR_KEY = '__kazumiInspector';

  /** @typedef {'m3u8'|'mpd'|'mp4'|'flv'|'ts'|'m4s'|'fmp4'|'webm'|'mov'|'avi'|'mkv'|'media'|'unknown'} VideoKind */

  /**
   * @typedef {Object} DetectHit
   * @property {string} url
   * @property {VideoKind} kind
   * @property {string} [mime]
   * @property {'url'|'mime'|'body'|'manifest'|'blob'|'data'|'embedded'} source
   * @property {number} confidence
   */

  /** @typedef {Object} DetectResponseInput
   *  @property {string} [url]
   *  @property {string} [contentType]
   *  @property {string|ArrayBuffer|Blob} [body]
   *  @property {string} [responseURL]
   */

  var EXT_KIND = {
    m3u8: 'm3u8', mpd: 'mpd', mp4: 'mp4', m4s: 'm4s', fmp4: 'fmp4',
    m4v: 'mp4', flv: 'flv', ts: 'ts', webm: 'webm', mov: 'mov', avi: 'avi', mkv: 'mkv',
  };

  var EXT_RE = /\.(m3u8|mpd|mp4|m4s|fmp4|m4v|flv|ts|webm|mov|avi|mkv)(\?|$|#)/i;
  var URL_RE = /(?:https?:\/\/|blob:|data:)[^\s"'<>\\)\]}]+/gi;
  var AD_HINTS = ['googleads', 'googlesyndication', 'adtrafficquality', 'doubleclick'];
  var VIDEO_MIMES = {
    'application/vnd.apple.mpegurl': 'm3u8',
    'application/x-mpegurl': 'm3u8',
    'application/dash+xml': 'mpd',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
    'video/x-flv': 'flv', 'video/x-matroska': 'mkv', 'video/avi': 'avi',
    'video/mp2t': 'ts', 'audio/mpegurl': 'm3u8', 'application/octet-stream': 'media',
  };

  function getInspector(target) {
    if (!target[INSPECTOR_KEY]) target[INSPECTOR_KEY] = {};
    return target[INSPECTOR_KEY];
  }

  /** @param {string} value @returns {string} */
  function normalizeMime(value) {
    return value ? String(value).split(';')[0].trim().toLowerCase() : '';
  }

  /** @param {string} url @returns {boolean} */
  function isAdUrl(url) {
    if (!url) return false;
    var lower = String(url).toLowerCase();
    for (var i = 0; i < AD_HINTS.length; i++) {
      if (lower.indexOf(AD_HINTS[i]) !== -1) return true;
    }
    return false;
  }

  /** @param {string} url @returns {VideoKind|null} */
  function kindFromUrl(url) {
    if (!url) return null;
    var value = String(url).trim();
    if (!value) return null;
    if (value.indexOf('blob:') === 0) return 'media';
    if (value.indexOf('data:') === 0) {
      return kindFromMime(value.slice(5).split(',')[0]) || 'media';
    }
    var match = value.match(EXT_RE);
    if (match) return EXT_KIND[match[1].toLowerCase()] || 'media';
    var q = value.match(/[?&](?:format|type|ext)=(m3u8|mpd|mp4|flv|ts|fmp4)/i);
    return q ? EXT_KIND[q[1].toLowerCase()] || 'media' : null;
  }

  /** @param {string} mime @returns {VideoKind|null} */
  function kindFromMime(mime) {
    var n = normalizeMime(mime);
    if (!n) return null;
    if (VIDEO_MIMES[n]) return VIDEO_MIMES[n];
    if (n.indexOf('video/') === 0) return 'media';
    if (n.indexOf('audio/') === 0 && n.indexOf('mpegurl') !== -1) return 'm3u8';
    return null;
  }

  /** @param {string} url @returns {boolean} */
  function isVideoUrl(url) {
    return !!url && !isAdUrl(url) && (!!kindFromUrl(url) || EXT_RE.test(String(url)));
  }

  /** @param {string} mime @returns {boolean} */
  function isVideoMime(mime) {
    return kindFromMime(mime) !== null;
  }

  /** @param {string} text @returns {string[]} */
  function extractUrls(text) {
    if (!text) return [];
    var found = [], seen = Object.create(null), m;
    URL_RE.lastIndex = 0;
    while ((m = URL_RE.exec(text)) !== null) {
      var raw = m[0].replace(/[\\'"`,;]+$/, '');
      if (!seen[raw] && isVideoUrl(raw)) { seen[raw] = 1; found.push(raw); }
    }
    return found;
  }

  /** @param {string} text @returns {{ kind: VideoKind, confidence: number }|null} */
  function detectManifest(text) {
    if (!text) return null;
    var s = String(text).trim().slice(0, 4096);
    if (!s) return null;
    if (s.indexOf('#EXTM3U') === 0 || s.indexOf('#EXT-X-') !== -1) return { kind: 'm3u8', confidence: 95 };
    if (s.indexOf('<MPD') !== -1 || s.indexOf('urn:mpeg:dash:schema:mpd') !== -1) {
      return { kind: 'mpd', confidence: 95 };
    }
    if (s.indexOf('#EXTINF:') !== -1) return { kind: 'm3u8', confidence: 80 };
    return null;
  }

  /** @param {Blob|File} blob @returns {DetectHit|null} */
  function detectBlob(blob) {
    if (!blob || typeof blob !== 'object') return null;
    var mime = normalizeMime(blob.type || '');
    var kind = kindFromMime(mime);
    if (!kind) return null;
    return { url: '', kind: kind, mime: mime, source: 'blob', confidence: mime ? 85 : 60 };
  }

  /** @param {string} input @returns {DetectHit|null} */
  function detectMedia(input) {
    if (!input) return null;
    var url = String(input).trim();
    if (!url || isAdUrl(url)) return null;
    var kind = kindFromUrl(url);
    if (!kind) return null;
    var source = url.indexOf('data:') === 0 ? 'data' : url.indexOf('blob:') === 0 ? 'blob' : 'url';
    return { url: url, kind: kind, source: source, confidence: source === 'url' ? 75 : 65 };
  }

  /** @param {string} url @param {VideoKind} kind @param {string} source @param {number} c @param {string} [mime] */
  function makeHit(url, kind, source, c, mime) {
    var h = { url: url, kind: kind, source: source, confidence: c };
    if (mime) h.mime = mime;
    return h;
  }

  /** @param {DetectResponseInput} input @returns {DetectHit[]} */
  function detectResponse(input) {
    input = input || {};
    var hits = [], seen = Object.create(null);
    function push(hit) {
      if (!hit || !hit.url || isAdUrl(hit.url)) return;
      var k = hit.url + '|' + hit.kind;
      if (seen[k]) return;
      seen[k] = 1;
      hits.push(hit);
    }

    var url = input.responseURL || input.url || '';
    var mime = normalizeMime(input.contentType || '');

    if (url && isVideoUrl(url)) push(makeHit(url, kindFromUrl(url) || 'media', 'url', 80, mime || undefined));
    if (mime && isVideoMime(mime) && url) push(makeHit(url, kindFromMime(mime) || 'media', 'mime', 85, mime));

    var sample = typeof input.body === 'string' ? input.body.slice(0, 8192) : '';
    if (sample) {
      var mf = detectManifest(sample);
      if (mf && url) push(makeHit(url, mf.kind, 'manifest', mf.confidence, mime || undefined));
      var embedded = extractUrls(sample);
      for (var i = 0; i < embedded.length; i++) {
        push(makeHit(embedded[i], kindFromUrl(embedded[i]) || 'media', 'embedded', 70));
      }
    }
    hits.sort(function (a, b) { return b.confidence - a.confidence; });
    return hits;
  }

  getInspector(global).detector = {
    isVideoUrl: isVideoUrl,
    isVideoMime: isVideoMime,
    isAdUrl: isAdUrl,
    kindFromUrl: kindFromUrl,
    kindFromMime: kindFromMime,
    extractUrls: extractUrls,
    detectManifest: detectManifest,
    detectBlob: detectBlob,
    detectMedia: detectMedia,
    detectResponse: detectResponse,
  };
})(typeof window !== 'undefined' ? window : globalThis);
