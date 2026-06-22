/**
 * WebView 嗅探注入脚本，对应 Kazumi `lib/webview/video` 中的 JS 脚本。
 *
 * postMessage 协议见 SnifferBridgeMessage；页面通过 __kazumiPost 回传视频 URL。
 */

/** WebView → RN 的 postMessage 协议（JSON 序列化后传递） */
export type SnifferBridgeMessage =
  /** 调试日志，payload 为 log 文本 */
  | { type: 'log'; payload: string }
  /** 现代模式嗅探到的视频 URL（m3u8/mp4） */
  | { type: 'video'; payload: string }
  /** Legacy 模式嗅探到的 iframe src，RN 侧需 decodeVideoSource 解码 */
  | { type: 'legacy'; payload: string };

export function parseSnifferMessage(raw: string): SnifferBridgeMessage | null {
  try {
    const parsed = JSON.parse(raw) as SnifferBridgeMessage;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'type' in parsed &&
      'payload' in parsed
    ) {
      return parsed;
    }
  } catch {
    // ignore malformed message
  }
  return null;
}

const BRIDGE = `
if (!window.__kazumiFormatLogArgs) {
  window.__kazumiFormatLogArgs = function(args) {
    return Array.prototype.map.call(args, function(arg) {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.stack || arg.message;
      try {
        return JSON.stringify(arg);
      } catch (e) {
        return String(arg);
      }
    }).join(' ');
  };
}
if (!window.__kazumiOriginalConsole) {
  window.__kazumiOriginalConsole = {};
  ['log', 'info', 'warn', 'error', 'debug'].forEach(function(method) {
    var original = console && console[method];
    window.__kazumiOriginalConsole[method] =
      typeof original === 'function' ? original.bind(console) : function() {};
  });
}
if (!window.__kazumiPost) {
  window.__kazumiPost = function(type, payload) {
    try {
      window.__kazumiOriginalConsole.log('[KazumiSniffer][' + type + ']', payload);
    } catch (e) {}
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload }));
    }
  };
}
if (!window.__kazumiConsolePatched) {
  window.__kazumiConsolePatched = true;
  ['log', 'info', 'warn', 'error', 'debug'].forEach(function(method) {
    console[method] = function() {
      var message = window.__kazumiFormatLogArgs(arguments);
      try {
        window.__kazumiOriginalConsole[method].apply(console, arguments);
      } catch (e) {}
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            payload: '[console.' + method + '] ' + message
          }));
        }
      } catch (e) {}
    };
  });
}
`;

/** 现代模式：拦截 fetch Response / XHR，检测 #EXTM3U 内容 */
export function buildModernOnLoadStartScript(): string {
  return `
${BRIDGE}
(function() {
  if (window.__kazumiModernStartInstalled) return;
  window.__kazumiModernStartInstalled = true;
  try { __kazumiPost('log', 'BlobParser script loaded: ' + window.location.href); } catch(e) {}
const _r_text = window.Response.prototype.text;
window.Response.prototype.text = function () {
  return new Promise((resolve, reject) => {
    _r_text.call(this).then((text) => {
      resolve(text);
      if (text.trim().startsWith("#EXTM3U")) {
        __kazumiPost('log', 'M3U8 source found: ' + this.url);
        __kazumiPost('video', this.url);
      }
    }).catch(reject);
  });
};

const _open = window.XMLHttpRequest.prototype.open;
window.XMLHttpRequest.prototype.open = function (...args) {
  this.addEventListener("load", () => {
    try {
      let content = this.responseText;
      if (content.trim().startsWith("#EXTM3U")) {
        __kazumiPost('log', 'M3U8 source found: ' + args[1]);
        __kazumiPost('video', args[1]);
      }
    } catch {}
  });
  return _open.apply(this, args);
};

function injectIntoIframe(iframe) {
  try {
    __kazumiPost('log', 'Injecting into iframe: ' + (iframe.src || iframe.getAttribute('src') || '<empty src>'));
    const iframeWindow = iframe.contentWindow;
    if (!iframeWindow) {
      __kazumiPost('log', 'Iframe inject skipped: contentWindow is empty');
      return;
    }
    if (!iframeWindow.Response || !iframeWindow.Response.prototype || !iframeWindow.Response.prototype.text) {
      __kazumiPost('log', 'Iframe inject skipped: Response.prototype.text is unavailable');
      return;
    }
    if (!iframeWindow.XMLHttpRequest || !iframeWindow.XMLHttpRequest.prototype || !iframeWindow.XMLHttpRequest.prototype.open) {
      __kazumiPost('log', 'Iframe inject skipped: XMLHttpRequest.prototype.open is unavailable');
      return;
    }
    if (iframeWindow.__kazumiIframeNetworkInstalled) {
      __kazumiPost('log', 'Iframe inject skipped: already installed');
      return;
    }
    iframeWindow.__kazumiIframeNetworkInstalled = true;
    const iframe_r_text = iframeWindow.Response.prototype.text;
    __kazumiPost('log', 'Iframe response prototype text: ');
    iframeWindow.Response.prototype.text = function () {
      return new Promise((resolve, reject) => {
        __kazumiPost('log', 'Calling iframe response prototype text: ' + (this && this.url ? this.url : '<unknown url>'));
        iframe_r_text.call(this).then((text) => {
          resolve(text);
          __kazumiPost('log', 'Iframe response text resolved, length: ' + text.length + ', url: ' + (this && this.url ? this.url : '<unknown url>'));
          if (text.trim().startsWith("#EXTM3U")) {
            __kazumiPost('log', 'M3U8 source found in iframe: ' + this.url);
            __kazumiPost('video', this.url);
          }
        }).catch((error) => {
          __kazumiPost('log', 'Iframe response text failed: ' + (error && (error.stack || error.message) || error));
          reject(error);
        });
      });
    };
    const iframe_open = iframeWindow.XMLHttpRequest.prototype.open;
    __kazumiPost('log', 'Iframe XMLHttpRequest prototype open: ');
    iframeWindow.XMLHttpRequest.prototype.open = function (...args) {
      __kazumiPost('log', 'Iframe XHR opened: ' + args[1]);
      this.addEventListener("load", () => {
        try {
          let content = this.responseText;
          __kazumiPost('log', 'Iframe XHR loaded, length: ' + content.length + ', url: ' + args[1]);
          if (content.trim().startsWith("#EXTM3U") && args[1] != null) {
            __kazumiPost('log', 'M3U8 source found in iframe: ' + args[1]);
            __kazumiPost('video', args[1]);
          }
        } catch (error) {
          __kazumiPost('log', 'Iframe XHR load inspect failed: ' + (error && (error.stack || error.message) || error));
        }
      });
      return iframe_open.apply(this, args);
    };
    __kazumiPost('log', 'Iframe network hooks installed: ' + (iframe.src || iframe.getAttribute('src') || '<empty src>'));
  } catch (error) {
    __kazumiPost('log', 'Iframe inject failed: ' + (error && (error.stack || error.message) || error));
  }
}

function setupIframeListeners() {
  document.querySelectorAll('iframe').forEach(iframe => {
    if (iframe.contentDocument) injectIntoIframe(iframe);
    // iframe.addEventListener('load', () => injectIntoIframe(iframe));
  });
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeName === 'IFRAME') {
            node.addEventListener('load', () => injectIntoIframe(node));
          }
          if (node.querySelectorAll) {
            node.querySelectorAll('iframe').forEach(iframe => {
              iframe.addEventListener('load', () => injectIntoIframe(iframe));
            });
          }
        });
      }
    });
  });
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    });
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupIframeListeners);
} else {
  setupIframeListeners();
}
})();
true;
`;
}

/** 现代模式：MutationObserver 监听 video 标签 src 变化 */
export function buildModernOnLoadStopScript(): string {
  return `
${BRIDGE}
(function() {
  if (window.__kazumiModernStopInstalled) return;
  window.__kazumiModernStopInstalled = true;
  __kazumiPost('log', 'VideoTagParser script loaded: ' + window.location.href);
const _observer = new MutationObserver((mutations) => {
  __kazumiPost('log', 'Scanning for video elements...');
  for (const mutation of mutations) {
    if (mutation.type === "attributes" && mutation.target.nodeName === "VIDEO") {
      if (processVideoElement(mutation.target)) return;
      continue;
    }
    for (const node of mutation.addedNodes) {
      if (node.nodeName === "VIDEO") {
        if (processVideoElement(node)) return;
      }
      if (node.querySelectorAll) {
        for (const video of node.querySelectorAll("video")) {
          if (processVideoElement(video)) return;
        }
      }
    }
  }
});
function processVideoElement(video) {
  let src = video.getAttribute('src');
  if (src && src.trim() !== '' && !src.startsWith('blob:') && src.indexOf('googleads') === -1) {
    _observer.disconnect();
    __kazumiPost('log', 'VIDEO source found: ' + src);
    __kazumiPost('video', src);
    return true;
  }
  const sources = video.getElementsByTagName('source');
  for (let i = 0; i < sources.length; i++) {
    src = sources[i].getAttribute('src');
    if (src && src.trim() !== '' && !src.startsWith('blob:') && src.indexOf('googleads') === -1) {
      _observer.disconnect();
      __kazumiPost('log', 'VIDEO source found (source tag): ' + src);
      __kazumiPost('video', src);
      return true;
    }
  }
  return false;
}
function setupVideoProcessing() {
  for (const video of document.querySelectorAll("video")) {
    if (processVideoElement(video)) return;
  }
  _observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupVideoProcessing);
} else {
  setupVideoProcessing();
}
})();
true;
`;
}

/** Legacy 模式：监听 iframe src，由 RN 侧 decodeVideoSource 解码 */
export function buildLegacyOnLoadStopScript(): string {
  return `
${BRIDGE}
(function() {
  if (window.__kazumiLegacyStopInstalled) return;
  window.__kazumiLegacyStopInstalled = true;
  __kazumiPost('log', 'JSBridgeDebug script loaded: ' + window.location.href);
function processIframeElement(iframe) {
  let src = iframe.getAttribute('src');
  if (src) __kazumiPost('legacy', src);
}
const _observer = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    if (mutation.type === 'attributes' && mutation.target.nodeName === 'IFRAME') {
      processIframeElement(mutation.target);
    } else {
      mutation.addedNodes.forEach(node => {
        if (node.nodeName === 'IFRAME') processIframeElement(node);
        if (node.querySelectorAll) node.querySelectorAll('iframe').forEach(processIframeElement);
      });
    }
  });
});
_observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
})();
true;
`;
}

/** 每秒轮询兜底：直接扫描 video 标签 */
export function buildModernPollScript(): string {
  return `
${BRIDGE}
(function() {
  var videos = document.querySelectorAll('video');
  for (var i = 0; i < videos.length; i++) {
    var src = videos[i].getAttribute('src');
    if (src && src.trim() !== '' && !src.startsWith('blob:') && src.indexOf('googleads') === -1) {
      __kazumiPost('video', src);
      return;
    }
    var sources = videos[i].getElementsByTagName('source');
    for (var j = 0; j < sources.length; j++) {
      src = sources[j].getAttribute('src');
      if (src && src.trim() !== '' && !src.startsWith('blob:') && src.indexOf('googleads') === -1) {
        __kazumiPost('video', src);
        return;
      }
    }
  }
})();
true;
`;
}

/** Legacy 轮询：扫描 iframe src */
export function buildLegacyPollScript(): string {
  return `
${BRIDGE}
(function() {
  var iframes = document.querySelectorAll('iframe');
  for (var i = 0; i < iframes.length; i++) {
    var src = iframes[i].getAttribute('src');
    if (src) __kazumiPost('legacy', src);
  }
})();
true;
`;
}
