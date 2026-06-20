/**
 * GitHub raw 资源前缀镜像配置（运行时 + 本地持久化）
 *
 * - 内存中的列表供 `getFastestURL` 竞速使用
 * - MMKV 持久化，key: `__github_mirror_prefixes_v1__`
 * - 业务通过 set / reset / configure / hydrate 统一读写
 */

import { createMMKV, type MMKV } from 'react-native-mmkv';
import * as RNFS from '@dr.pogodin/react-native-fs';

/** 前缀镜像：将完整原始 URL 拼在 prefix 后，例如 `https://ghproxy.imciel.com/` + 原 URL */
export type GitHubMirrorPrefix = string;

export type GitHubMirrorPrefixMirrorsSnapshot = {
  prefixes: readonly GitHubMirrorPrefix[];
};

export type ConfigureGitHubMirrorPrefixMirrorsOptions = {
  /** 完全替换当前列表 */
  replace?: GitHubMirrorPrefix[];
  /** 插入到列表头部 */
  prepend?: GitHubMirrorPrefix[];
  /** 追加到列表尾部 */
  append?: GitHubMirrorPrefix[];
  /** 恢复为内置默认列表（可与 replace / prepend / append 组合使用） */
  reset?: boolean;
  /** 为 false 时不写入本地存储（默认 true） */
  persist?: boolean;
};

export type SetGitHubMirrorPrefixMirrorsOptions = {
  /** 为 false 时不写入本地存储（默认 true） */
  persist?: boolean;
};

/** MMKV 实例 id（独立于 app-store / 小程序其它存储） */
const GITHUB_MIRROR_MMKV_ID = '__htyf_github_mirror_config__';

/** 持久化 JSON 键名 */
export const GITHUB_MIRROR_STORAGE_KEY = '__github_mirror_prefixes_v1__';

/** 内置默认前缀镜像（与历史 getFastestURL 行为一致） */
export const DEFAULT_GITHUB_MIRROR_PREFIXES: readonly GitHubMirrorPrefix[] = [
  'https://ghproxy.imciel.com/',
  'https://github.mxw.qzz.io/',
  'http://jp-proxy.gitwarp.top:3000/',
  'http://jp1-proxy.gitwarp.top:8123/',
  'http://kr2-proxy.gitwarp.top:9980/',
  'http://kr1-proxy.gitwarp.top:8081/',
  'https://ghproxylist.com/',
  'https://gh-proxy.org/',
  'https://gh-proxy.com/',
  'https://gh.llkk.cc/',
  'https://junlong.plus/ztool/gh/',
  'https://gh.idayer.com/',
  'https://ghproxy.net/',
] as const;

let prefixMirrors: GitHubMirrorPrefix[] = [...DEFAULT_GITHUB_MIRROR_PREFIXES];
let mmkv: MMKV | undefined;

const normalizePrefix = (prefix: string): GitHubMirrorPrefix =>
  prefix.endsWith('/') ? prefix : `${prefix}/`;

function getMirrorStorage(): MMKV {
  if (!mmkv) {
    mmkv = createMMKV({
      id: GITHUB_MIRROR_MMKV_ID,
      path: `${RNFS.DocumentDirectoryPath}/${GITHUB_MIRROR_MMKV_ID}`,
      encryptionKey: `${GITHUB_MIRROR_MMKV_ID}_encryptionKey`,
    });
  }
  return mmkv;
}

function parseStoredPrefixes(raw: string | undefined): GitHubMirrorPrefix[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((item) => typeof item === 'string' && item.trim().length > 0)
    ) {
      return parsed.map(normalizePrefix);
    }
  } catch {
    // ignore corrupt storage
  }
  return null;
}

/** 从 MMKV 读取已保存列表（无数据或损坏时返回 null） */
export function loadGitHubMirrorPrefixesFromStorage(): GitHubMirrorPrefix[] | null {
  const raw = getMirrorStorage().getString(GITHUB_MIRROR_STORAGE_KEY);
  return parseStoredPrefixes(raw);
}

/** 将列表写入 MMKV */
export function persistGitHubMirrorPrefixes(prefixes: readonly GitHubMirrorPrefix[]): void {
  getMirrorStorage().set(GITHUB_MIRROR_STORAGE_KEY, JSON.stringify([...prefixes]));
}

/** 删除本地持久化记录（不修改当前内存列表） */
export function clearGitHubMirrorStorage(): void {
  getMirrorStorage().remove(GITHUB_MIRROR_STORAGE_KEY);
}

/**
 * 启动时从本地恢复；无有效记录则保持当前内存（默认为内置列表）
 */
export function hydrateGitHubMirrorFromStorage(): GitHubMirrorPrefixMirrorsSnapshot {
  const saved = loadGitHubMirrorPrefixesFromStorage();
  if (saved) {
    prefixMirrors = saved;
  }
  return getGitHubMirrorPrefixMirrors();
}

function applyPrefixMirrors(
  prefixes: GitHubMirrorPrefix[],
  options?: { persist?: boolean },
): void {
  prefixMirrors = prefixes.map(normalizePrefix);
  if (options?.persist !== false) {
    persistGitHubMirrorPrefixes(prefixMirrors);
  }
}

/** 获取当前前缀镜像配置（返回副本，避免外部直接改内部数组） */
export function getGitHubMirrorPrefixMirrors(): GitHubMirrorPrefixMirrorsSnapshot {
  return { prefixes: [...prefixMirrors] };
}

/** 获取当前配置（与 getGitHubMirrorPrefixMirrors 等价，便于业务侧命名） */
export const getGitHubMirrorConfig = getGitHubMirrorPrefixMirrors;

/** 整体替换前缀镜像列表（默认写入本地存储） */
export function setGitHubMirrorPrefixMirrors(
  prefixes: GitHubMirrorPrefix[],
  options?: SetGitHubMirrorPrefixMirrorsOptions,
): GitHubMirrorPrefixMirrorsSnapshot {
  applyPrefixMirrors(prefixes, options);
  return getGitHubMirrorPrefixMirrors();
}

/** 恢复为内置默认列表（默认写入本地存储） */
export function resetGitHubMirrorPrefixMirrors(
  options?: SetGitHubMirrorPrefixMirrorsOptions,
): GitHubMirrorPrefixMirrorsSnapshot {
  applyPrefixMirrors([...DEFAULT_GITHUB_MIRROR_PREFIXES], options);
  return getGitHubMirrorPrefixMirrors();
}

/**
 * 增量调整前缀镜像列表，返回调整后的快照（默认写入本地存储）
 */
export function configureGitHubMirrorPrefixMirrors(
  options: ConfigureGitHubMirrorPrefixMirrorsOptions,
): GitHubMirrorPrefixMirrorsSnapshot {
  const shouldPersist = options.persist !== false;

  if (options.reset) {
    prefixMirrors = [...DEFAULT_GITHUB_MIRROR_PREFIXES];
  }
  if (options.replace) {
    prefixMirrors = options.replace.map(normalizePrefix);
  }
  if (options.prepend?.length) {
    prefixMirrors = [
      ...options.prepend.map(normalizePrefix),
      ...prefixMirrors,
    ];
  }
  if (options.append?.length) {
    prefixMirrors = [
      ...prefixMirrors,
      ...options.append.map(normalizePrefix),
    ];
  }

  if (shouldPersist) {
    persistGitHubMirrorPrefixes(prefixMirrors);
  }

  return getGitHubMirrorPrefixMirrors();
}

/**
 * 清除本地存储并恢复内置默认（配置页「清除本地配置」）
 */
export function clearGitHubMirrorConfigAndResetDefaults(): GitHubMirrorPrefixMirrorsSnapshot {
  clearGitHubMirrorStorage();
  return resetGitHubMirrorPrefixMirrors();
}

/** 将前缀列表转为 getFastestURL 使用的 URL 变换函数 */
export function buildPrefixMirrorTransforms(
  prefixes: readonly GitHubMirrorPrefix[],
): Array<(originalUrl: string) => string> {
  return prefixes.map(
    (prefix) => (originalUrl: string) => `${normalizePrefix(prefix)}${originalUrl}`,
  );
}
