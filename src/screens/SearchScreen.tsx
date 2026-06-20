import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { BangumiCard } from '@/components/BangumiCard';
import { EmptyState, LoadingView } from '@/components/LoadingView';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { RootStackParamList } from '@/navigation/types';
import { searchBangumiSubjects } from '@/services/bangumi-api';
import { colors } from '@/theme/colors';
import type { BangumiItem } from '@/types/bangumi';

export function SearchScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Search'>>();
  const [keyword, setKeyword] = useState(route.params?.tag ?? '');
  const [items, setItems] = useState<BangumiItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async () => {
    const q = keyword.trim();
    if (!q) {
      return;
    }
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      setItems(await searchBangumiSubjects(q));
    } catch (e) {
      setError(String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  useEffect(() => {
    if (route.params?.tag) {
      void runSearch();
    }
  }, [route.params?.tag, runSearch]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="搜索"
        showBack
        onBack={() => navigation.goBack()}
      />
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          value={keyword}
          onChangeText={setKeyword}
          placeholder="输入番剧名、标签…"
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={() => void runSearch()}
        />
        <Pressable style={styles.searchBtn} onPress={() => void runSearch()}>
          <Text style={styles.searchBtnText}>搜索</Text>
        </Pressable>
      </View>
      {loading ? <LoadingView label="搜索中…" /> : null}
      {!loading && error ? <EmptyState message={error} /> : null}
      {!loading && searched && !error && items.length === 0 ? (
        <EmptyState message="没有找到相关番剧" />
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        numColumns={3}
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
  searchBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    fontSize: 14,
  },
  searchBtn: {
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  searchBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 10,
    paddingBottom: 24,
  },
});
