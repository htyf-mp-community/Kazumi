import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { BangumiCard } from '@/components/BangumiCard';
import { EmptyState } from '@/components/LoadingView';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { RootStackParamList } from '@/navigation/types';
import { useCollectStore } from '@/stores/collect-store';
import { colors } from '@/theme/colors';
import { COLLECT_TAB_LABELS, COLLECT_TAB_TYPES } from '@/types/bangumi';

export function CollectScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [tabIndex, setTabIndex] = useState(0);
  const listByType = useCollectStore((s) => s.listByType);
  const collectType = COLLECT_TAB_TYPES[tabIndex] ?? COLLECT_TAB_TYPES[0];
  const items = useMemo(() => listByType(collectType), [collectType, listByType]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="追番" subtitle="本地收藏列表" large />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}>
        {COLLECT_TAB_LABELS.map((label, index) => {
          const active = index === tabIndex;
          return (
            <Pressable
              key={label}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTabIndex(index)}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {items.length === 0 ? (
        <EmptyState message={`暂无「${COLLECT_TAB_LABELS[tabIndex]}」番剧`} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.bangumi.id)}
          numColumns={3}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <BangumiCard
              item={item.bangumi}
              onPress={() => navigation.navigate('Info', { bangumi: item.bangumi })}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabs: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    height: 32,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  list: {
    paddingHorizontal: 10,
    paddingBottom: 24,
  },
});
