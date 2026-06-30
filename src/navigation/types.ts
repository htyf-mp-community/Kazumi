import type { NavigatorScreenParams } from '@react-navigation/native';

import type { PluginRule, Road } from '@/collector';
import type { BangumiItem } from '@/types/bangumi';

export type TabParamList = {
  Popular: undefined;
  Timeline: undefined;
  Collect: undefined;
  My: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<TabParamList>;
  Search: { tag?: string } | undefined;
  History: undefined;
  Info: { bangumi: BangumiItem };
  PluginManage: undefined;
  BangumiProxy: undefined;
  PluginEditor: { rule: PluginRule; previousName?: string };
  PluginTest: { rule: PluginRule };
  Player: {
    bangumi: BangumiItem;
    rule: PluginRule;
    roads: Road[];
    roadIndex: number;
    episodeIndex: number;
    episodeHref: string;
    pluginName: string;
    videoUrl?: string;
  };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
