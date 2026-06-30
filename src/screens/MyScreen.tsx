import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { ScreenHeader } from '@/components/ScreenHeader';
import { SettingsGroup, SettingsItem } from '@/components/SettingsGroup';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';

export function MyScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.root}>
      <ScreenHeader title="我的" large />
      <View style={styles.body}>
        <SettingsGroup title="播放历史与视频源">
          <SettingsItem
            title="历史记录"
            description="查看播放历史记录"
            onPress={() => navigation.navigate('History')}
          />
          <SettingsItem
            title="规则管理"
            description="管理番剧资源规则"
            onPress={() => navigation.navigate('PluginManage')}
          />
          <SettingsItem
            title="bgm.tv反代"
            description="反代bgm.tv的API请求"
            onPress={() => navigation.navigate('BangumiProxy')}
          />
        </SettingsGroup>
        <SettingsGroup title="关于">
          <SettingsItem
            title="Kazumi RN"
            description="核心页面移植版 · 采集引擎已接入"
            onPress={() => {}}
          />
        </SettingsGroup>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
});
