import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { useCollector } from '@/collector';
import { VideoPlayer } from '@/components/VideoPlayer';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { RootStackParamList } from '@/navigation/types';
import { useHistoryStore } from '@/stores/history-store';
import { colors } from '@/theme/colors';
import { getDisplayName } from '@/types/bangumi';

export function PlayerScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Player'>>();
  const { getRuleEngine } = useCollector();
  const upsertHistory = useHistoryStore((s) => s.upsert);

  const { bangumi, rule, roads: initialRoads, pluginName } = route.params;
  const [roads] = useState(initialRoads);
  const [roadIndex, setRoadIndex] = useState(route.params.roadIndex);
  const [episodeIndex, setEpisodeIndex] = useState(route.params.episodeIndex);
  const [videoUrl, setVideoUrl] = useState(route.params.videoUrl ?? '');
  const [resolving, setResolving] = useState(false);

  const currentRoad = roads[roadIndex];
  const episodeHref = currentRoad?.data[episodeIndex] ?? route.params.episodeHref;
  const episodeName =
    currentRoad?.identifier[episodeIndex] ?? `第 ${episodeIndex + 1} 集`;
  const title = getDisplayName(bangumi);

  const resolveCurrentEpisode = useCallback(
    async (href: string, epIndex: number, rdIndex: number) => {
      if (!href) {
        return;
      }
      setResolving(true);
      setVideoUrl('');
      try {
        const source = await getRuleEngine().resolveVideo(rule, href, {
          timeoutMs: 45_000,
          debug: true,
        });
        setVideoUrl(source.url);
        upsertHistory({
          bangumi,
          pluginName,
          episodeIndex: epIndex,
          roadIndex: rdIndex,
          episodeName:
            roads[rdIndex]?.identifier[epIndex] ?? `第 ${epIndex + 1} 集`,
          episodeHref: href,
          progressMs: 0,
        });
      } catch (error) {
        Alert.alert('嗅探失败', String(error));
      } finally {
        setResolving(false);
      }
    },
    [bangumi, getRuleEngine, pluginName, roads, rule, upsertHistory],
  );

  useEffect(() => {
    if (route.params.videoUrl) {
      return;
    }
    void resolveCurrentEpisode(episodeHref, episodeIndex, roadIndex);
  }, []);

  const episodes = useMemo(() => currentRoad?.data ?? [], [currentRoad?.data]);

  const switchEpisode = useCallback(
    (index: number) => {
      setEpisodeIndex(index);
      const href = currentRoad?.data[index];
      if (href) {
        void resolveCurrentEpisode(href, index, roadIndex);
      }
    },
    [currentRoad?.data, resolveCurrentEpisode, roadIndex],
  );

  const switchRoad = useCallback(
    async (index: number) => {
      setRoadIndex(index);
      setEpisodeIndex(0);
      const href = roads[index]?.data[0];
      if (href) {
        await resolveCurrentEpisode(href, 0, index);
      }
    },
    [resolveCurrentEpisode, roads],
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={title}
        subtitle={`${pluginName} · ${episodeName}`}
        showBack
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {resolving ? (
          <View style={styles.resolving}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.resolvingText}>正在嗅探播放地址…</Text>
          </View>
        ) : null}
        {videoUrl ? <VideoPlayer uri={videoUrl} /> : null}

        {roads.length > 1 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>播放线路</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {roads.map((road, index) => (
                <Pressable
                  key={`${road.name}-${index}`}
                  style={[styles.chip, index === roadIndex && styles.chipActive]}
                  onPress={() => void switchRoad(index)}>
                  <Text style={[styles.chipText, index === roadIndex && styles.chipTextActive]}>
                    {road.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>选集 · {episodes.length} 集</Text>
          <FlatList
            data={episodes}
            numColumns={4}
            scrollEnabled={false}
            keyExtractor={(href, index) => `${href}-${index}`}
            renderItem={({ item, index }) => {
              const active = index === episodeIndex;
              const label = currentRoad?.identifier[index] ?? `${index + 1}`;
              return (
                <Pressable
                  style={[styles.episodeCell, active && styles.episodeCellActive]}
                  onPress={() => switchEpisode(index)}>
                  <Text
                    style={[styles.episodeText, active && styles.episodeTextActive]}
                    numberOfLines={2}>
                    {label}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  resolving: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  resolvingText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
    color: colors.text,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
  },
  episodeCell: {
    flex: 1,
    margin: 4,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 4,
  },
  episodeCellActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  episodeText: {
    fontSize: 12,
    textAlign: 'center',
    color: colors.text,
  },
  episodeTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
});
