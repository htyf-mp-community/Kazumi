/**
 * @fileoverview Kazumi Inspector Bridge — 统一消息发送层。
 *
 * 职责：
 * - 封装 WebView → React Native 的 postMessage 协议
 * - 自动附加页面上下文（href / title / timestamp）
 * - RN 不可用时降级到 console，不影响页面逻辑
 *
 * 全局仅暴露 `window.__kazumiInspector`；本模块挂载在 `__kazumiInspector.bridge`。
 *
 * @module bridge
 */

(function initKazumiBridge(global) {
  'use strict';

  /** @typedef {'log'|'video'|'legacy'|'network'|'debug'|'error'|string} BridgeMessageType */

  /**
   * @typedef {Object} BridgeMessage
   * @property {BridgeMessageType} type - 消息类型
   * @property {*} data - 消息载荷（视频 URL、日志对象、网络记录等）
   * @property {string} href - 发送时页面 URL
   * @property {string} title - 发送时 document.title
   * @property {number} timestamp - Unix 毫秒时间戳
   */

  /**
   * @typedef {Object} BridgeConfig
   * @property {boolean} [enabled=true] - 是否允许向 RN 发送消息
   * @property {boolean} [consoleFallback=true] - RN 不可用时是否输出到 console
   * @property {string} [consolePrefix='[KazumiInspector]'] - console 前缀
   * @property {(message: BridgeMessage) => BridgeMessage} [transform] - 发送前变换
   * @property {(message: BridgeMessage) => void} [onSend] - 发送成功回调（测试用）
   * @property {(error: Error, message: BridgeMessage) => void} [onError] - 发送失败回调
   */

  var INSPECTOR_KEY = '__kazumiInspector';
  var DEFAULT_PREFIX = '[KazumiInspector]';

  /**
   * 获取或创建全局 Inspector 命名空间。
   * @param {Window | typeof globalThis} target
   * @returns {Record<string, unknown>}
   */
  function getInspectorNamespace(target) {
    if (!target[INSPECTOR_KEY]) {
      target[INSPECTOR_KEY] = {};
    }
    return /** @type {Record<string, unknown>} */ (target[INSPECTOR_KEY]);
  }

  /**
   * 安全序列化任意值为 JSON 字符串；循环引用时降级为 String。
   * @param {*} value
   * @returns {string}
   */
  function safeStringify(value) {
    try {
      return JSON.stringify(value);
    } catch (_error) {
      try {
        return JSON.stringify({ fallback: String(value) });
      } catch (_error2) {
        return '{"fallback":"[unserializable]"}';
      }
    }
  }

  /**
   * 读取当前页面上下文，兼容 iframe / 早期注入阶段。
   * @param {Window | typeof globalThis} target
   * @returns {{ href: string, title: string }}
   */
  function readPageContext(target) {
    var href = '';
    var title = '';

    try {
      if (target.location && target.location.href) {
        href = String(target.location.href);
      }
    } catch (_error) {
      href = '';
    }

    try {
      if (target.document && typeof target.document.title === 'string') {
        title = target.document.title;
      }
    } catch (_error) {
      title = '';
    }

    return { href: href, title: title };
  }

  /**
   * 检测 React Native WebView postMessage 通道是否可用。
   * @param {Window | typeof globalThis} target
   * @returns {((payload: string) => void) | null}
   */
  function resolvePostChannel(target) {
    try {
      var rnWebView = target.ReactNativeWebView;
      if (rnWebView && typeof rnWebView.postMessage === 'function') {
        return rnWebView.postMessage.bind(rnWebView);
      }
    } catch (_error) {
      // cross-origin or restricted access
    }
    return null;
  }

  /**
   * Bridge 工厂：每个 Window（含 iframe）可拥有独立实例，共享配置。
   * @param {Window | typeof globalThis} targetWindow
   * @param {BridgeConfig} [sharedConfig]
   * @returns {BridgeApi}
   */
  function createBridge(targetWindow, sharedConfig) {
    /** @type {BridgeConfig} */
    var config = sharedConfig || {
      enabled: true,
      consoleFallback: true,
      consolePrefix: DEFAULT_PREFIX,
    };

    /**
     * @typedef {Object} BridgeApi
     * @property {(type: BridgeMessageType, data?: *) => BridgeMessage | null} post
     * @property {(type: BridgeMessageType, data?: *) => BridgeMessage} buildMessage
     * @property {() => boolean} isChannelAvailable
     * @property {() => { href: string, title: string }} getPageContext
     * @property {(partial: Partial<BridgeConfig>) => BridgeConfig} configure
     * @property {() => BridgeConfig} getConfig
     * @property {() => void} destroy
     */

    /**
     * 构造标准 Bridge 消息。
     * @param {BridgeMessageType} type
     * @param {*} [data]
     * @returns {BridgeMessage}
     */
    function buildMessage(type, data) {
      var context = readPageContext(targetWindow);
      return {
        type: type,
        data: data === undefined ? null : data,
        href: context.href,
        title: context.title,
        timestamp: Date.now(),
      };
    }

    /**
     * 向 RN 或 console 发送消息；发送失败不影响调用方。
     * @param {BridgeMessageType} type
     * @param {*} [data]
     * @returns {BridgeMessage | null} 成功构建并尝试发送时返回消息体
     */
    function post(type, data) {
      if (!config.enabled) {
        return null;
      }

      var message = buildMessage(type, data);

      try {
        if (typeof config.transform === 'function') {
          message = config.transform(message);
        }
      } catch (error) {
        notifyError(error instanceof Error ? error : new Error(String(error)), message);
      }

      var delivered = false;

      try {
        var postMessage = resolvePostChannel(targetWindow);
        if (postMessage) {
          postMessage(safeStringify(message));
          delivered = true;
        }
      } catch (error) {
        notifyError(error instanceof Error ? error : new Error(String(error)), message);
      }

      if (!delivered && config.consoleFallback) {
        emitConsoleFallback(message);
      }

      if (delivered && typeof config.onSend === 'function') {
        try {
          config.onSend(message);
        } catch (_error) {
          // observer must not break bridge
        }
      }

      return message;
    }

    /**
     * @param {BridgeMessage} message
     */
    function emitConsoleFallback(message) {
      var prefix = config.consolePrefix || DEFAULT_PREFIX;
      var line = prefix + ' [' + message.type + '] ' + safeStringify(message.data);
      var meta = ' @ ' + message.href;

      try {
        if (message.type === 'error') {
          console.error(line, meta);
          return;
        }
        if (message.type === 'log' || message.type === 'debug') {
          console.log(line, meta);
          return;
        }
        console.info(line, meta);
      } catch (_error) {
        // console may be overridden or unavailable
      }
    }

    /**
     * @param {Error} error
     * @param {BridgeMessage} message
     */
    function notifyError(error, message) {
      if (typeof config.onError === 'function') {
        try {
          config.onError(error, message);
        } catch (_error) {
          // ignore
        }
      }
    }

    /** @returns {boolean} */
    function isChannelAvailable() {
      return resolvePostChannel(targetWindow) !== null;
    }

    /**
     * 合并配置；返回最新快照。
     * @param {Partial<BridgeConfig>} partial
     * @returns {BridgeConfig}
     */
    function configure(partial) {
      if (partial && typeof partial === 'object') {
        if (partial.enabled !== undefined) config.enabled = !!partial.enabled;
        if (partial.consoleFallback !== undefined) {
          config.consoleFallback = !!partial.consoleFallback;
        }
        if (partial.consolePrefix !== undefined) {
          config.consolePrefix = String(partial.consolePrefix);
        }
        if (typeof partial.transform === 'function') {
          config.transform = partial.transform;
        }
        if (typeof partial.onSend === 'function') {
          config.onSend = partial.onSend;
        }
        if (typeof partial.onError === 'function') {
          config.onError = partial.onError;
        }
      }
      return {
        enabled: config.enabled,
        consoleFallback: config.consoleFallback,
        consolePrefix: config.consolePrefix,
        transform: config.transform,
        onSend: config.onSend,
        onError: config.onError,
      };
    }

    /** @returns {BridgeConfig} */
    function getConfig() {
      return configure({});
    }

    /** 释放实例引用；不恢复 RN 通道。 */
    function destroy() {
      config.enabled = false;
    }

    return {
      post: post,
      buildMessage: buildMessage,
      isChannelAvailable: isChannelAvailable,
      getPageContext: function getPageContext() {
        return readPageContext(targetWindow);
      },
      configure: configure,
      getConfig: getConfig,
      destroy: destroy,
    };
  }

  var inspector = getInspectorNamespace(global);

  /** 主 frame Bridge（默认实例） */
  var mainBridge = createBridge(global, {
    enabled: true,
    consoleFallback: true,
    consolePrefix: DEFAULT_PREFIX,
  });

  /** 按 Window 缓存 iframe Bridge，WeakMap 避免泄漏 */
  var bridgeByWindow = new WeakMap();
  bridgeByWindow.set(global, mainBridge);

  /**
   * @typedef {Object} BridgeRegistry
   * @property {typeof createBridge} create
   * @property {() => BridgeApi} getMain
   * @property {(targetWindow: Window) => BridgeApi} forWindow
   * @property {(type: BridgeMessageType, data?: *) => BridgeMessage | null} post
   * @property {(partial: Partial<BridgeConfig>) => BridgeConfig} configure
   * @property {() => BridgeConfig} getConfig
   * @property {() => boolean} isChannelAvailable
   * @property {() => void} destroy
   */

  /** @type {BridgeRegistry} */
  var bridgeRegistry = {
    /**
     * 为指定 Window 创建或获取 Bridge。
     * @param {Window} targetWindow
     * @returns {BridgeApi}
     */
    forWindow: function forWindow(targetWindow) {
      if (!targetWindow || targetWindow === global) {
        return mainBridge;
      }
      var existing = bridgeByWindow.get(targetWindow);
      if (existing) {
        return existing;
      }
      var instance = createBridge(targetWindow, mainBridge.getConfig());
      bridgeByWindow.set(targetWindow, instance);
      return instance;
    },

    /** @returns {BridgeApi} */
    getMain: function getMain() {
      return mainBridge;
    },

    /**
     * 创建独立 Bridge（不写入 WeakMap 缓存）。
     * @param {Window} targetWindow
     * @param {BridgeConfig} [config]
     * @returns {BridgeApi}
     */
    create: createBridge,

    /**
     * 主 frame 快捷发送。
     * @param {BridgeMessageType} type
     * @param {*} [data]
     * @returns {BridgeMessage | null}
     */
    post: function post(type, data) {
      return mainBridge.post(type, data);
    },

    /**
     * 更新主 Bridge 配置，并同步到已缓存的 iframe Bridge。
     * @param {Partial<BridgeConfig>} partial
     * @returns {BridgeConfig}
     */
    configure: function configure(partial) {
      var next = mainBridge.configure(partial);
      return next;
    },

    /** @returns {BridgeConfig} */
    getConfig: function getConfig() {
      return mainBridge.getConfig();
    },

    /** @returns {boolean} */
    isChannelAvailable: function isChannelAvailable() {
      return mainBridge.isChannelAvailable();
    },

    /** 禁用主 Bridge 并清空 WeakMap 引用。 */
    destroy: function destroy() {
      mainBridge.destroy();
      bridgeByWindow = new WeakMap();
      bridgeByWindow.set(global, mainBridge);
    },
  };

  inspector.bridge = bridgeRegistry;
  inspector.version = inspector.version || '0.1.0';
})(typeof window !== 'undefined' ? window : globalThis);
