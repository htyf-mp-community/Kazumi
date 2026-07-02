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
    if (iframe.src && iframe.src.trim() !== 'about:blank') {
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