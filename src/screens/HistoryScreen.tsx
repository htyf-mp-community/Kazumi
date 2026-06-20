import { useCallback } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { EmptyState } from '@/components/LoadingView';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { RootStackParamList } from '@/navigation/types';
import { useHistoryStore } from '@/stores/history-store';
import { usePluginStore } from '@/stores/plugin-store';
import { colors } from '@/theme/colors';
import { getBangumiCover, getDisplayName } from '@/types/bangumi';

export function HistoryScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const items = useHistoryStore((s) => s.items);
  const remove = useHistoryStore((s) => s.remove);
  const clearAll = useHistoryStore((s) => s.clearAll);
  const activeRule = usePluginStore((s) => s.activeRule);

  const confirmClear = useCallback(() => {
    Alert.alert('记录管理', '确认要清除所有历史记录吗？', [
      { text: '取消', style: 'cancel' },
      { text: '确认', style: 'destructive', onPress: clearAll },
    ]);
  }, [clearAll]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="历史记录"
        showBack
        onBack={() => navigation.goBack()}
        right={
          items.length > 0 ? (
            <Pressable onPress={confirmClear}>
              <Text style={styles.clearText}>清除</Text>
            </Pressable>
          ) : undefined
        }
      />
      {items.length === 0 ? <EmptyState message="暂无播放历史" /> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const cover = getBangumiCover(item.bangumi);
          const title = getDisplayName(item.bangumi);
          return (
            <Pressable
              style={styles.row}
              onPress={() => {
                if (!activeRule) {
                  Alert.alert('提示', '请先在规则管理中加载视频源');
                  navigation.navigate('PluginManage');
                  return;
                }
                navigation.navigate('Player', {
                  bangumi: item.bangumi,
                  rule: activeRule,
                  roads: [
                    {
                      name: '历史线路',
                      data: [item.episodeHref],
                      identifier: [item.episodeName || `第 ${item.episodeIndex + 1} 集`],
                    },
                  ],
                  roadIndex: 0,
                  episodeIndex: item.episodeIndex,
                  episodeHref: item.episodeHref,
                  pluginName: item.pluginName,
                });
              }}
              onLongPress={() => remove(item.id)}>
              {cover ? (
                <Image source={{ uri: cover }} style={styles.cover} />
              ) : (
                <View style={[styles.cover, styles.coverPlaceholder]} />
              )}
              <View style={styles.meta}>
                <Text style={styles.title} numberOfLines={2}>
                  {title}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {item.episodeName || `第 ${item.episodeIndex + 1} 集`} · {item.pluginName}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  clearText: {
    color: colors.primary,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cover: {
    width: 96,
    height: 72,
    backgroundColor: '#ddd',
  },
  coverPlaceholder: {
    backgroundColor: '#d8d8dc',
  },
  meta: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
