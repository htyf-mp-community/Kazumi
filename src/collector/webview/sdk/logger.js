/**
 * @fileoverview Kazumi Inspector Logger — 分级日志模块。
 *
 * 支持模块名、级别过滤、全局开关；可选经 bridge 回传 RN。
 * 挂载于 `window.__kazumiInspector.logger`。
 *
 * @module logger
 */

(function initKazumiLogger(global) {
  'use strict';

  var INSPECTOR_KEY = '__kazumiInspector';

  /** @typedef {'debug'|'info'|'warn'|'error'} LogLevel */

  /** @enum {number} */
  var LEVEL_RANK = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
  };

  /**
   * @typedef {Object} LoggerConfig
   * @property {boolean} [enabled=true] - 总开关
   * @property {LogLevel} [level='debug'] - 最低输出级别
   * @property {boolean} [bridge=true] - 是否经 bridge 发送
   * @property {boolean} [console=true] - 是否输出到 console
   * @property {Record<string, boolean>} [modules] - 模块级开关；缺省视为 true
   */

  /**
   * @typedef {Object} LoggerApi
   * @property {(module: string, message: string, extra?: *) => void} debug
   * @property {(module: string, message: string, extra?: *) => void} info
   * @property {(module: string, message: string, extra?: *) => void} warn
   * @property {(module: string, message: string, extra?: *) => void} error
   * @property {(name: string) => ModuleLogger} create
   * @property {(partial: Partial<LoggerConfig>) => LoggerConfig} configure
   * @property {() => LoggerConfig} getConfig
   * @property {() => void} destroy
   */

  /**
   * @typedef {Object} ModuleLogger
   * @property {(message: string, extra?: *) => void} debug
   * @property {(message: string, extra?: *) => void} info
   * @property {(message: string, extra?: *) => void} warn
   * @property {(message: string, extra?: *) => void} error
   */

  /** @type {LoggerConfig} */
  var config = {
    enabled: true,
    level: 'debug',
    bridge: true,
    console: true,
    modules: {},
  };

  /**
   * @param {Window | typeof globalThis} target
   * @returns {Record<string, unknown>}
   */
  function getInspector(target) {
    if (!target[INSPECTOR_KEY]) {
      target[INSPECTOR_KEY] = {};
    }
    return /** @type {Record<string, unknown>} */ (target[INSPECTOR_KEY]);
  }

  /**
   * @param {*} value
   * @returns {string}
   */
  function safeStringify(value) {
    if (value === undefined) {
      return '';
    }
    try {
      return JSON.stringify(value);
    } catch (_error) {
      return String(value);
    }
  }

  /**
   * @param {LogLevel} level
   * @returns {boolean}
   */
  function shouldLogLevel(level) {
    if (!config.enabled) {
      return false;
    }
    var current = LEVEL_RANK[config.level || 'debug'] || LEVEL_RANK.debug;
    var incoming = LEVEL_RANK[level] || LEVEL_RANK.debug;
    return incoming >= current;
  }

  /**
   * @param {string} module
   * @returns {boolean}
   */
  function shouldLogModule(module) {
    if (!module) {
      return true;
    }
    if (!config.modules) {
      return true;
    }
    if (Object.prototype.hasOwnProperty.call(config.modules, module)) {
      return !!config.modules[module];
    }
    return true;
  }

  /**
   * @returns {((type: string, data?: *) => *) | null}
   */
  function getBridgePost() {
    try {
      var inspector = getInspector(global);
      var bridge = inspector.bridge;
      if (bridge && typeof bridge.post === 'function') {
        return bridge.post.bind(bridge);
      }
    } catch (_error) {
      // ignore
    }
    return null;
  }

  /**
   * @param {LogLevel} level
   * @param {string} module
   * @param {string} message
   * @param {*} [extra]
   */
  function emit(level, module, message, extra) {
    if (!shouldLogLevel(level) || !shouldLogModule(module)) {
      return;
    }

    var payload = {
      level: level,
      module: module,
      message: message,
    };

    if (extra !== undefined) {
      payload.extra = extra;
    }

    if (config.console) {
      var line =
        '[KazumiInspector][' + level + '][' + module + '] ' + message +
        (extra !== undefined ? ' ' + safeStringify(extra) : '');

      try {
        var fn = console[level] || console.log;
        fn.call(console, line);
      } catch (_error) {
        // console 可能被 Hook
      }
    }

    if (config.bridge) {
      var bridgeType = level === 'error' ? 'error' : 'log';
      var post = getBridgePost();
      if (post) {
        try {
          post(bridgeType, payload);
        } catch (_error) {
          // bridge 失败不影响页面
        }
      }
    }
  }

  /**
   * @param {LogLevel} level
   * @param {string} module
   * @param {string} message
   * @param {*} [extra]
   */
  function logAt(level, module, message, extra) {
    emit(level, module || 'core', String(message), extra);
  }

  /** @type {LoggerApi} */
  var logger = {
    debug: function debug(module, message, extra) {
      logAt('debug', module, message, extra);
    },
    info: function info(module, message, extra) {
      logAt('info', module, message, extra);
    },
    warn: function warn(module, message, extra) {
      logAt('warn', module, message, extra);
    },
    error: function error(module, message, extra) {
      logAt('error', module, message, extra);
    },

    /**
     * 创建绑定模块名的子 logger。
     * @param {string} name
     * @returns {ModuleLogger}
     */
    create: function create(name) {
      var moduleName = String(name);
      return {
        debug: function debug(message, extra) {
          logAt('debug', moduleName, message, extra);
        },
        info: function info(message, extra) {
          logAt('info', moduleName, message, extra);
        },
        warn: function warn(message, extra) {
          logAt('warn', moduleName, message, extra);
        },
        error: function error(message, extra) {
          logAt('error', moduleName, message, extra);
        },
      };
    },

    /**
     * @param {Partial<LoggerConfig>} partial
     * @returns {LoggerConfig}
     */
    configure: function configure(partial) {
      if (!partial || typeof partial !== 'object') {
        return logger.getConfig();
      }
      if (partial.enabled !== undefined) config.enabled = !!partial.enabled;
      if (partial.level !== undefined) config.level = partial.level;
      if (partial.bridge !== undefined) config.bridge = !!partial.bridge;
      if (partial.console !== undefined) config.console = !!partial.console;
      if (partial.modules && typeof partial.modules === 'object') {
        config.modules = Object.assign({}, config.modules, partial.modules);
      }
      return logger.getConfig();
    },

    /** @returns {LoggerConfig} */
    getConfig: function getConfig() {
      return {
        enabled: config.enabled,
        level: config.level,
        bridge: config.bridge,
        console: config.console,
        modules: Object.assign({}, config.modules),
      };
    },

    destroy: function destroy() {
      config.enabled = false;
    },
  };

  getInspector(global).logger = logger;
})(typeof window !== 'undefined' ? window : globalThis);
