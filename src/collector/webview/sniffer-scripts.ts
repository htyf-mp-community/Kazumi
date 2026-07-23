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
  | { type: 'legacy'; payload: string }
  /** 嗅探到的 iframe src */
  | { type: 'iframe'; payload: { url: string; header: Record<string, string> } };

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
/** 
 * 桥接代码 用于 RN 和 WebView 之间的通信
*/
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
(function () {
  if (window.VConsole) {
    if (!window.__vConsoleInstance) {
      window.__vConsoleInstance = new window.VConsole();
    }
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://unpkg.com/vconsole@latest/dist/vconsole.min.js';
  script.onload = function () {
    if (!window.__vConsoleInstance) {
      window.__vConsoleInstance = new window.VConsole();
      console.log('vConsole loaded');
    }
  };
  script.onerror = function () {
    console.error('vConsole load failed');
  };

  document.head.appendChild(script);
})();
`;

/** 现代模式：拦截 fetch Response / XHR，检测 #EXTM3U 内容 */
export function buildModernOnLoadStartScript(): string {
  return `
${BRIDGE}
(function() {
  if (!window.__kazumiPost) { window.__kazumiPost = console.warn}
  // if (window.__kazumiModernStartInstalled) return;
  window.__kazumiModernStartInstalled = true;
  try { __kazumiPost('log', 'BlobParser script loaded: ' + window.location.href); } catch(e) {}
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    __kazumiPost('log', 'fetch: ' + args);
    // 获取 url 并判断是否是 m3u8 或 mp4 文件
    if (args[0] && /\.(m3u8|mp4)$/.test(args[0].trim())) {
      __kazumiPost('log', 'M3U8 source found: ' + args[0]);
      __kazumiPost('video', args[0]);
    }
    return originalFetch.apply(this, args);
  };

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
    this.addEventListener('error', (err) => {
      console.log("status:", xhr.status);
      console.log("readyState:", xhr.readyState);
      console.log("response:", xhr.response);
      console.log("responseText:", xhr.responseText);
      // alert(456 + 'xhr.status:' + xhr.status + 'xhr.readyState:' + xhr.readyState + 'xhr.response:' + xhr.response + 'xhr.responseText:' + xhr.responseText)
    });
    return _open.apply(this, args);
  };

  // const xhr = new XMLHttpRequest()
  // xhr.open('GET', 'https://www.gugu3.com//index.php/vod/play/id/5002/sid/1/nid/1.html', true);
  // xhr.send();

  // // 测试用
  // fetch('https://jsonplaceholder.typicode.com/todos/1').then(response => response.text()).then(text => {
  //   __kazumiPost('log', 'fetch text: ' + text);
  // }).catch(error => {
  //   __kazumiPost('log', 'fetch error: ' + error);
  // });

  setInterval(() => {
    try {
      var videos = document.querySelectorAll('video');
      for (var i = 0; i < videos.length; i++) {
        var src = videos[i].getAttribute('src');
        if (src && src.trim() !== '' && !src.startsWith('blob:') && src.indexOf('googleads') === -1) {
          console.error('src', src)
          window.top.__kazumiPost('video', src);
          return;
        }
        var sources = videos[i].getElementsByTagName('source');
        for (var j = 0; j < sources.length; j++) {
          src = sources[j].getAttribute('src');
          if (src && src.trim() !== '' && !src.startsWith('blob:') && src.indexOf('googleads') === -1) {
            console.error('src', src)
            window.top.__kazumiPost('video', src);
            return;
          }
        }
      }
    } catch (error) {
      console.error(error)
    }
  }, 4000);

  function injectIntoIframe(iframe) {
    if (iframe.src && iframe.src.trim() !== 'about:blank'
     && iframe.src.indexOf('googleads') === -1 && iframe.src.indexOf('google.com') === -1
     && !iframe.src.startsWith(window.location.origin)
    ) {
      alert(123)
      window.__kazumiPost('iframe', {
        url: iframe.src,
        header: {
          referer: window.location.origin,
          'user-agent': window.navigator.userAgent,
        }
      });
    }
  }
  // 监听 iframe 加载
  function setupIframeListeners() {
    console.log('setupIframeListeners')
    try {
      document.querySelectorAll('iframe').forEach(iframe => {
        if (iframe.src && iframe.src.trim() !== 'about:blank') {
          injectIntoIframe(iframe);
        }
        // iframe.addEventListener('load', () => injectIntoIframe(iframe));
      });
        __kazumiPost('log', 'Iframe mutation: ');
        
      const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          __kazumiPost('log', 'Iframe mutation: ');
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
    } catch (error) {
      console.error(error)
      __kazumiPost('log', 'Iframe inject failed: ' + (error && (error.stack || error.message) || error));
    }
  }
  // 监听 document 加载
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
