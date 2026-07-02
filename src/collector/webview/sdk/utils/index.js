/**
 * @fileoverview Kazumi Inspector 通用工具。
 *
 * Hook 模块的基础设施：原始引用保存、安装标记、安全调用、插件工厂等。
 * 挂载于 `window.__kazumiInspector.utils`。
 *
 * @module utils
 */

(function initKazumiUtils(global) {
  'use strict';

  var INSPECTOR_KEY = '__kazumiInspector';

  /**
   * @typedef {Object} HookContext
   * @property {Window} window - 目标 Window（主 frame 或 iframe）
   * @property {Record<string, unknown>} inspector - __kazumiInspector 命名空间
   * @property {boolean} [enabled=true] - Manager 全局开关
   */

  /**
   * @typedef {Object} HookHandle
   * @property {boolean} installed - 是否已成功安装
   * @property {() => void} destroy - 卸载并恢复原始 API
   */

  /**
   * @typedef {Object} PluginDefinition
   * @property {string} name - 插件唯一名称（用于安装标记）
   * @property {(ctx: HookContext) => *} install - 安装逻辑，返回可传给 uninstall 的状态
   * @property {(ctx: HookContext, state: *) => void} [uninstall] - 卸载逻辑
   */

  /** @type {WeakMap<object, Map<string, *>>} */
  var originalsByTarget = new WeakMap();

  /** @type {WeakMap<object, Set<string>>} */
  var installedByTarget = new WeakMap();

  /**
   * 获取 Inspector 命名空间；不存在则创建空对象。
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
   * 安全执行函数；异常被捕获，不影响调用方。
   * @template T
   * @param {(...args: *) => T} fn
   * @param {*} [thisArg]
   * @param {*[]} [args]
   * @param {T} [fallback]
   * @returns {T | undefined}
   */
  function safeCall(fn, thisArg, args, fallback) {
    try {
      return fn.apply(thisArg, args || []);
    } catch (_error) {
      return fallback;
    }
  }

  /**
   * 安全 JSON 序列化。
   * @param {*} value
   * @returns {string}
   */
  function safeStringify(value) {
    try {
      return JSON.stringify(value);
    } catch (_error) {
      return String(value);
    }
  }

  /**
   * 判断值是否为 Window 对象。
   * @param {*} value
   * @returns {boolean}
   */
  function isWindow(value) {
    return value != null && value === value.window;
  }

  /**
   * 保存原始引用（仅首次写入）。
   * @param {object} target
   * @param {string} key
   * @param {*} original
   * @returns {*} 传入的 original
   */
  function storeOriginal(target, key, original) {
    var map = originalsByTarget.get(target);
    if (!map) {
      map = new Map();
      originalsByTarget.set(target, map);
    }
    if (!map.has(key)) {
      map.set(key, original);
    }
    return original;
  }

  /**
   * 读取已保存的原始引用。
   * @param {object} target
   * @param {string} key
   * @returns {*|undefined}
   */
  function getOriginal(target, key) {
    var map = originalsByTarget.get(target);
    return map ? map.get(key) : undefined;
  }

  /**
   * 恢复对象上的单个属性为原始值。
   * @param {object} target
   * @param {string} key
   * @returns {boolean}
   */
  function restoreOriginal(target, key) {
    var map = originalsByTarget.get(target);
    if (!map || !map.has(key)) {
      return false;
    }
    target[key] = map.get(key);
    map.delete(key);
    if (map.size === 0) {
      originalsByTarget.delete(target);
    }
    return true;
  }

  /**
   * 标记插件已在目标上下文安装。
   * @param {object} target
   * @param {string} name
   */
  function markInstalled(target, name) {
    var set = installedByTarget.get(target);
    if (!set) {
      set = new Set();
      installedByTarget.set(target, set);
    }
    set.add(name);
  }

  /**
   * @param {object} target
   * @param {string} name
   * @returns {boolean}
   */
  function isInstalled(target, name) {
    var set = installedByTarget.get(target);
    return set ? set.has(name) : false;
  }

  /**
   * @param {object} target
   * @param {string} name
   */
  function unmarkInstalled(target, name) {
    var set = installedByTarget.get(target);
    if (set) {
      set.delete(name);
      if (set.size === 0) {
        installedByTarget.delete(target);
      }
    }
  }

  /**
   * 判断两个 Window 是否同源（跨域访问会返回 false）。
   * @param {Window} a
   * @param {Window} b
   * @returns {boolean}
   */
  function isSameOrigin(a, b) {
    return safeCall(
      function compareOrigin() {
        return a.location.origin === b.location.origin;
      },
      null,
      [],
      false,
    );
  }

  /**
   * 获取 frame 标识，用于日志与 video hit 的 frame 字段。
   * @param {Window} target
   * @returns {string}
   */
  function getFrameLabel(target) {
    return safeCall(
      function readHref() {
        return target === target.top ? 'top' : String(target.location.href || 'iframe');
      },
      null,
      [],
      'unknown',
    );
  }

  /**
   * 包装对象方法；保存原始引用并返回 restore 函数。
   * @param {object} owner
   * @param {string} methodName
   * @param {(original: Function) => Function} wrapperFactory
   * @returns {{ restore: () => void } | null}
   */
  function patchMethod(owner, methodName, wrapperFactory) {
    var original = owner[methodName];
    if (typeof original !== 'function') {
      return null;
    }
    storeOriginal(owner, methodName, original);
    owner[methodName] = wrapperFactory(original);
    return {
      restore: function restore() {
        restoreOriginal(owner, methodName);
      },
    };
  }

  /**
   * 包装原型方法。
   * @param {object} prototype
   * @param {string} methodName
   * @param {(original: Function) => Function} wrapperFactory
   * @returns {{ restore: () => void } | null}
   */
  function patchPrototype(prototype, methodName, wrapperFactory) {
    return patchMethod(prototype, methodName, wrapperFactory);
  }

  /**
   * 创建标准 Hook 插件：支持重复 install（先 destroy 再装）、installed 标记。
   * @param {PluginDefinition} definition
   * @returns {{ name: string, install: (ctx: HookContext) => HookHandle }}
   */
  function createPlugin(definition) {
    return {
      name: definition.name,
      install: function install(ctx) {
        var target = ctx.window || global;
        var noop = function noop() {};

        if (isInstalled(target, definition.name)) {
          return { installed: true, destroy: noop };
        }

        var state = null;
        try {
          state = definition.install(ctx);
          markInstalled(target, definition.name);
        } catch (_error) {
          return { installed: false, destroy: noop };
        }

        return {
          installed: true,
          destroy: function destroy() {
            safeCall(definition.uninstall || noop, null, [ctx, state]);
            if (state && typeof state.restore === 'function') {
              safeCall(state.restore, null, []);
            } else if (state && Array.isArray(state.patches)) {
              for (var i = state.patches.length - 1; i >= 0; i--) {
                var patch = state.patches[i];
                if (patch && typeof patch.restore === 'function') {
                  safeCall(patch.restore, null, []);
                }
              }
            }
            unmarkInstalled(target, definition.name);
          },
        };
      },
    };
  }

  /**
   * 构造 Hook 上下文。
   * @param {Window} [targetWindow]
   * @returns {HookContext}
   */
  function createContext(targetWindow) {
    var win = targetWindow || global;
    return {
      window: win,
      inspector: getInspector(global),
      enabled: true,
    };
  }

  var utils = {
    getInspector: getInspector,
    safeCall: safeCall,
    safeStringify: safeStringify,
    isWindow: isWindow,
    storeOriginal: storeOriginal,
    getOriginal: getOriginal,
    restoreOriginal: restoreOriginal,
    markInstalled: markInstalled,
    isInstalled: isInstalled,
    unmarkInstalled: unmarkInstalled,
    isSameOrigin: isSameOrigin,
    getFrameLabel: getFrameLabel,
    patchMethod: patchMethod,
    patchPrototype: patchPrototype,
    createPlugin: createPlugin,
    createContext: createContext,
  };

  getInspector(global).utils = utils;
})(typeof window !== 'undefined' ? window : globalThis);
