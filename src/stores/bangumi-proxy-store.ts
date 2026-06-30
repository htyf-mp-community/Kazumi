import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const KAZUMI_UA =
  'Predidit/Kazumi/2.1.6 (Android) (https://github.com/Predidit/Kazumi)';

export type BangumiMirror = {
  url: string;
  headers: Record<string, string>;
};

export type BangumiProxyEntry = {
  id: string;
  label: string;
  nextBaseUrl: string;
  apiBaseUrl: string;
  headers: Record<string, string>;
};

export const DEFAULT_BANGUMI_PROXY_ENTRIES: BangumiProxyEntry[] = [
  {
    id: 'bangumi-lol',
    label: 'bangumi.lol',
    nextBaseUrl: 'https://next.bangumi.lol',
    apiBaseUrl: 'https://api.bangumi.lol',
    headers: {
      Accept: 'application/json',
      'User-Agent': SAFARI_UA,
    },
  },
  {
    id: 'bgm-tv',
    label: 'bgm.tv',
    nextBaseUrl: 'https://next.bgm.tv',
    apiBaseUrl: 'https://api.bgm.tv',
    headers: {
      Accept: 'application/json',
      'User-Agent': KAZUMI_UA,
    },
  },
];

const BUILTIN_PROXY_IDS = new Set(
  DEFAULT_BANGUMI_PROXY_ENTRIES.map((entry) => entry.id),
);

export function isBuiltinBangumiProxyEntry(id: string): boolean {
  return BUILTIN_PROXY_IDS.has(id);
}

function normalizeEntries(entries: BangumiProxyEntry[]): BangumiProxyEntry[] {
  const custom = entries.filter((entry) => !isBuiltinBangumiProxyEntry(entry.id));
  return [...DEFAULT_BANGUMI_PROXY_ENTRIES, ...custom];
}

type BangumiProxyState = {
  entries: BangumiProxyEntry[];
  addEntry: (entry: Omit<BangumiProxyEntry, 'id'>) => void;
  removeEntry: (id: string) => void;
  resetToDefaults: () => void;
  getNextMirrors: () => BangumiMirror[];
  getApiMirrors: () => BangumiMirror[];
};

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function toMirror(baseUrl: string, headers: Record<string, string>): BangumiMirror {
  return {
    url: normalizeBaseUrl(baseUrl),
    headers,
  };
}

export const useBangumiProxyStore = create<BangumiProxyState>()(
  persist(
    (set, get) => ({
      entries: [...DEFAULT_BANGUMI_PROXY_ENTRIES],
      addEntry: (entry) => {
        const id = `custom-${Date.now()}`;
        set((state) => ({
          entries: [
            ...state.entries,
            {
              ...entry,
              id,
              nextBaseUrl: normalizeBaseUrl(entry.nextBaseUrl),
              apiBaseUrl: normalizeBaseUrl(entry.apiBaseUrl || entry.nextBaseUrl),
            },
          ],
        }));
      },
      removeEntry: (id) => {
        if (isBuiltinBangumiProxyEntry(id)) {
          return;
        }
        set((state) => ({
          entries: state.entries.filter((item) => item.id !== id),
        }));
      },
      resetToDefaults: () => set({ entries: [...DEFAULT_BANGUMI_PROXY_ENTRIES] }),
      getNextMirrors: () =>
        normalizeEntries(get().entries).map((entry) =>
          toMirror(entry.nextBaseUrl, entry.headers),
        ),
      getApiMirrors: () =>
        normalizeEntries(get().entries).map((entry) =>
          toMirror(entry.apiBaseUrl, entry.headers),
        ),
    }),
    {
      name: 'kazumi-bangumi-proxy',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ entries: state.entries }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<BangumiProxyState> | undefined;
        return {
          ...current,
          ...saved,
          entries: normalizeEntries(saved?.entries ?? current.entries),
        };
      },
    },
  ),
);
