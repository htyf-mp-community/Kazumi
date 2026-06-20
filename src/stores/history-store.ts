import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { WatchHistoryItem } from '@/types/bangumi';

type HistoryState = {
  items: WatchHistoryItem[];
  upsert: (
    entry: Omit<WatchHistoryItem, 'id' | 'lastWatchTime'> & { lastWatchTime?: number },
  ) => void;
  remove: (id: string) => void;
  clearAll: () => void;
};

function makeHistoryId(pluginName: string, bangumiId: number): string {
  return `${pluginName}:${bangumiId}`;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      items: [],
      upsert: (entry) => {
        const id = makeHistoryId(entry.pluginName, entry.bangumi.id);
        const lastWatchTime = entry.lastWatchTime ?? Date.now();
        set((state) => {
          const others = state.items.filter((item) => item.id !== id);
          return {
            items: [{ ...entry, id, lastWatchTime }, ...others].sort(
              (a, b) => b.lastWatchTime - a.lastWatchTime,
            ),
          };
        });
      },
      remove: (id) => {
        set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
      },
      clearAll: () => set({ items: [] }),
    }),
    {
      name: 'kazumi-history',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export function findHistoryForBangumi(
  items: WatchHistoryItem[],
  bangumiId: number,
): WatchHistoryItem | undefined {
  return items.find((item) => item.bangumi.id === bangumiId);
}
