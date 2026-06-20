import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  buildKazumiRuleUrl,
  fetchPluginRuleFromUrl,
  type PluginRule,
} from '@/collector';

type PluginState = {
  activeRule: PluginRule | null;
  installedRules: PluginRule[];
  loading: boolean;
  error: string | null;
  setActiveRule: (rule: PluginRule | null) => void;
  saveRule: (rule: PluginRule, previousName?: string) => void;
  loadRuleFromUrl: (url: string) => Promise<PluginRule>;
  loadRuleByName: (name: string) => Promise<PluginRule>;
  removeRule: (name: string) => void;
};

export const usePluginStore = create<PluginState>()(
  persist(
    (set, get) => ({
      activeRule: null,
      installedRules: [],
      loading: false,
      error: null,
      setActiveRule: (rule) => set({ activeRule: rule }),
      saveRule: (rule, previousName) => {
        const oldName = (previousName ?? rule.name).trim();
        set((state) => {
          const filtered = state.installedRules.filter(
            (item) => item.name !== oldName && item.name !== rule.name,
          );
          const wasActive =
            state.activeRule?.name === oldName || state.activeRule?.name === rule.name;
          return {
            installedRules: [rule, ...filtered],
            activeRule: wasActive ? rule : state.activeRule,
          };
        });
      },
      loadRuleFromUrl: async (url) => {
        set({ loading: true, error: null });
        try {
          const rule = await fetchPluginRuleFromUrl(url);
          set((state) => {
            const others = state.installedRules.filter((item) => item.name !== rule.name);
            return {
              activeRule: rule,
              installedRules: [rule, ...others],
              loading: false,
            };
          });
          return rule;
        } catch (error) {
          const message = String(error);
          set({ loading: false, error: message });
          throw error;
        }
      },
      loadRuleByName: async (name) => {
        const url = buildKazumiRuleUrl(name);
        if (!url) {
          throw new Error('规则名无效');
        }
        return get().loadRuleFromUrl(url);
      },
      removeRule: (name) => {
        set((state) => ({
          installedRules: state.installedRules.filter((item) => item.name !== name),
          activeRule: state.activeRule?.name === name ? null : state.activeRule,
        }));
      },
    }),
    {
      name: 'kazumi-plugins',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        activeRule: state.activeRule,
        installedRules: state.installedRules,
      }),
    },
  ),
);
