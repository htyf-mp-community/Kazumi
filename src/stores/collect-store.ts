import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { BangumiItem, CollectTypeValue, CollectedBangumi } from '@/types/bangumi';
import { CollectType } from '@/types/bangumi';

type CollectState = {
  items: CollectedBangumi[];
  setCollectType: (bangumi: BangumiItem, type: CollectTypeValue) => void;
  removeCollect: (bangumiId: number) => void;
  getCollectType: (bangumiId: number) => CollectTypeValue;
  listByType: (type: CollectTypeValue) => CollectedBangumi[];
};

export const useCollectStore = create<CollectState>()(
  persist(
    (set, get) => ({
      items: [],
      setCollectType: (bangumi, type) => {
        if (type === CollectType.none) {
          get().removeCollect(bangumi.id);
          return;
        }
        set((state) => {
          const others = state.items.filter((item) => item.bangumi.id !== bangumi.id);
          return {
            items: [{ bangumi, type, updatedAt: Date.now() }, ...others],
          };
        });
      },
      removeCollect: (bangumiId) => {
        set((state) => ({
          items: state.items.filter((item) => item.bangumi.id !== bangumiId),
        }));
      },
      getCollectType: (bangumiId) => {
        return (
          get().items.find((item) => item.bangumi.id === bangumiId)?.type ??
          CollectType.none
        );
      },
      listByType: (type) => {
        return get()
          .items.filter((item) => item.type === type)
          .sort((a, b) => b.updatedAt - a.updatedAt);
      },
    }),
    {
      name: 'kazumi-collect',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
