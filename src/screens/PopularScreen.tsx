import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { BangumiCard } from '@/components/BangumiCard';
import { HeaderAction } from '@/components/HeaderAction';
import { EmptyState, LoadingView } from '@/components/LoadingView';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { RootStackParamList } from '@/navigation/types';
import { fetchTrendingSubjects } from '@/services/bangumi-api';
import { colors } from '@/theme/colors';
import type { BangumiItem } from '@/types/bangumi';

export function PopularScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<BangumiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const list = await fetchTrendingSubjects(0, 24);
      setItems(list);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="热门番组"
        subtitle="Bangumi 趋势推荐"
        large
        right={
          <>
            <HeaderAction label="搜索" onPress={() => navigation.navigate('Search')} />
            <HeaderAction label="历史" onPress={() => navigation.navigate('History')} />
          </>
        }
      />
      {loading && items.length === 0 ? <LoadingView /> : null}
      {!loading && error ? <EmptyState message={error} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState message="暂无推荐内容" />
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        numColumns={3}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
        }
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <BangumiCard
            item={item}
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
  list: {
    paddingHorizontal: 10,
    paddingBottom: 24,
  },
});
