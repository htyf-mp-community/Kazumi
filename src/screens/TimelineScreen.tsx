import { useCallback, useEffect, useState } from 'react';
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
import { EmptyState, LoadingView } from '@/components/LoadingView';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { RootStackParamList } from '@/navigation/types';
import { fetchCalendar } from '@/services/bangumi-api';
import { colors } from '@/theme/colors';
import type { BangumiItem } from '@/types/bangumi';

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export function TimelineScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [calendar, setCalendar] = useState<BangumiItem[][]>([]);
  const [dayIndex, setDayIndex] = useState(() => {
    const jsDay = new Date().getDay();
    return jsDay === 0 ? 6 : jsDay - 1;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCalendar(await fetchCalendar());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dayItems = calendar[dayIndex] ?? [];

  return (
    <View style={styles.root}>
      <ScreenHeader title="时间表" subtitle="每日放送" large />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}>
        {WEEKDAY_LABELS.map((label, index) => {
          const active = index === dayIndex;
          return (
            <Pressable
              key={label}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setDayIndex(index)}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {loading ? <LoadingView /> : null}
      {!loading && error ? <EmptyState message={error} /> : null}
      {!loading && !error && dayItems.length === 0 ? (
        <EmptyState message="今日暂无番组" />
      ) : null}
      <FlatList
        data={dayItems}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <BangumiCard
            item={item}
            compact
            subtitle={item.airDate ? `放送 ${item.airDate}` : undefined}
            onPress={() => navigation.navigate('Info', { bangumi: item })}
          />
        )}
      />
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
    marginBottom: 10,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
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
