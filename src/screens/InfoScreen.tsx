import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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
import type { PluginRule, SearchAllResult } from '@/collector';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { RootStackParamList } from '@/navigation/types';
import { fetchBangumiSubject } from '@/services/bangumi-api';
import { useCollectStore } from '@/stores/collect-store';
import { usePluginStore } from '@/stores/plugin-store';
import { colors } from '@/theme/colors';
import {
  COLLECT_TAB_LABELS,
  COLLECT_TAB_TYPES,
  CollectType,
  getBangumiCover,
  getDisplayName,
  getSecondaryName,
  type BangumiItem,
} from '@/types/bangumi';

type RuleSearchStatus = SearchAllResult['status'] | 'pending';

function pickDefaultRuleTab(
  results: SearchAllResult[],
  rules: PluginRule[],
  activeRule: PluginRule | null,
): number {
  const activeIndex = activeRule
    ? rules.findIndex((rule) => rule.name === activeRule.name)
    : -1;
  if (activeIndex >= 0 && results[activeIndex]?.status === 'success') {
    return activeIndex;
  }
  const firstSuccess = results.findIndex((result) => result.status === 'success');
  if (firstSuccess >= 0) {
    return firstSuccess;
  }
  return activeIndex >= 0 ? activeIndex : 0;
}

function getRuleStatusColor(status: RuleSearchStatus): string {
  switch (status) {
    case 'success':
      return '#34c759';
    case 'noResult':
      return '#ff9500';
    case 'captcha':
      return '#007aff';
    case 'error':
      return '#ff3b30';
    default:
      return '#c7c7cc';
  }
}

function getRuleStatusMessage(ruleName: string, status: RuleSearchStatus): string {
  switch (status) {
    case 'pending':
      return `${ruleName} 正在检索…`;
    case 'noResult':
      return `${ruleName} 无结果，可切换其他规则重试`;
    case 'captcha':
      return `${ruleName} 需要验证码验证`;
    case 'error':
      return `${ruleName} 检索失败，请稍后重试`;
    default:
      return `${ruleName} 未找到匹配源`;
  }
}

export function InfoScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Info'>>();
  const { getRuleEngine } = useCollector();
  const activeRule = usePluginStore((s) => s.activeRule);
  const installedRules = usePluginStore((s) => s.installedRules);
  const getCollectType = useCollectStore((s) => s.getCollectType);
  const setCollectType = useCollectStore((s) => s.setCollectType);

  const [bangumi, setBangumi] = useState<BangumiItem>(route.params.bangumi);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sourceVisible, setSourceVisible] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [roadLoading, setRoadLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchAllResult[]>([]);
  const [ruleTabIndex, setRuleTabIndex] = useState(0);

  const cover = getBangumiCover(bangumi);
  const title = getDisplayName(bangumi);
  const secondaryName = getSecondaryName(bangumi);
  const collectType = getCollectType(bangumi.id);
  const collectLabel =
    collectType !== CollectType.none
      ? `${COLLECT_TAB_LABELS[Math.max(0, COLLECT_TAB_TYPES.indexOf(collectType))]} · 取消`
      : '加入追番';

  useEffect(() => {
    if (bangumi.summary.trim() && bangumi.nameCn.trim()) {
      return;
    }
    setLoadingDetail(true);
    void fetchBangumiSubject(bangumi.id)
      .then(setBangumi)
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
  }, [bangumi.id, bangumi.summary, bangumi.nameCn]);

  const searchKeyword = useMemo(
    () => bangumi.nameCn.trim() || bangumi.name.trim() || title,
    [bangumi.name, bangumi.nameCn, title],
  );

  const searchAllRules = useCallback(async () => {
    const keyword = searchKeyword.trim();
    if (!keyword || installedRules.length === 0) {
      return;
    }
    setSearchLoading(true);
    setSearchResults([]);
    try {
      const results = await getRuleEngine().searchAll(installedRules, keyword);
      setSearchResults(results);
      setRuleTabIndex(pickDefaultRuleTab(results, installedRules, activeRule));
    } catch (error) {
      Alert.alert('选源失败', String(error));
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [activeRule, getRuleEngine, installedRules, searchKeyword]);

  const openWatch = useCallback(() => {
    if (installedRules.length === 0) {
      Alert.alert('提示', '请先在规则管理中安装视频源', [
        { text: '取消', style: 'cancel' },
        { text: '去设置', onPress: () => navigation.navigate('PluginManage') },
      ]);
      return;
    }
    setSourceVisible(true);
    setSearchResults([]);
    setRuleTabIndex(0);
    void searchAllRules();
  }, [installedRules.length, navigation, searchAllRules]);

  const pickSource = useCallback(
    async (rule: PluginRule, href: string) => {
      setRoadLoading(true);
      try {
        const roads = await getRuleEngine().fetchRoads(rule, href);
        if (roads.length === 0 || !roads[0]?.data.length) {
          Alert.alert('提示', '未找到播放线路');
          return;
        }
        const roadIndex = 0;
        const episodeIndex = 0;
        const episodeHref = roads[roadIndex].data[episodeIndex] ?? '';
        setSourceVisible(false);
        navigation.navigate('Player', {
          bangumi,
          rule,
          roads,
          roadIndex,
          episodeIndex,
          episodeHref,
          pluginName: rule.name,
        });
      } catch (error) {
        Alert.alert('线路加载失败', String(error));
      } finally {
        setRoadLoading(false);
      }
    },
    [bangumi, getRuleEngine, navigation],
  );

  const tagText = useMemo(
    () => bangumi.tags.slice(0, 6).map((t) => t.name).join(' · '),
    [bangumi.tags],
  );

  const selectedRule = installedRules[ruleTabIndex] ?? null;
  const selectedResult = searchResults[ruleTabIndex];
  const selectedSources = selectedResult?.response?.data ?? [];
  const selectedStatus: RuleSearchStatus = searchLoading
    ? 'pending'
    : (selectedResult?.status ?? 'pending');
  const hasAnySuccess = searchResults.some((result) => result.status === 'success');

  return (
    <View style={styles.root}>
      <ScreenHeader title="" showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          {cover ? (
            <Image source={{ uri: cover }} style={styles.cover} />
          ) : (
            <View style={[styles.cover, styles.coverPlaceholder]} />
          )}
          <View style={styles.heroMeta}>
            <Text style={styles.title}>{title}</Text>
            {secondaryName ? (
              <Text style={styles.subtitle}>{secondaryName}</Text>
            ) : null}
            <Text style={styles.metaLine}>
              {bangumi.ratingScore > 0 ? `评分 ${bangumi.ratingScore.toFixed(1)} · ` : ''}
              {bangumi.airDate ? `放送 ${bangumi.airDate}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={styles.collectBtn}
            onPress={() => {
              if (collectType !== CollectType.none) {
                setCollectType(bangumi, CollectType.none);
                return;
              }
              setCollectType(bangumi, COLLECT_TAB_TYPES[0]);
            }}>
            <Text style={styles.collectBtnText}>{collectLabel}</Text>
          </Pressable>
          <Pressable style={styles.watchBtn} onPress={() => void openWatch()}>
            <Text style={styles.watchBtnText}>开始观看</Text>
          </Pressable>
        </View>

        {tagText ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>标签</Text>
            <Text style={styles.body}>{tagText}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>概览</Text>
          {loadingDetail ? <ActivityIndicator color={colors.primary} /> : null}
          <Text style={styles.body}>
            {bangumi.summary.trim() || '暂无简介'}
          </Text>
        </View>
      </ScrollView>

      <Modal visible={sourceVisible} animationType="slide" onRequestClose={() => setSourceVisible(false)}>
        <View style={styles.modalRoot}>
          <ScreenHeader
            title="选择视频源"
            subtitle={`搜索「${searchKeyword}」· ${installedRules.length} 个规则`}
            showBack
            onBack={() => setSourceVisible(false)}
          />
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.ruleTabs}>
              {installedRules.map((rule, index) => {
                const active = index === ruleTabIndex;
                const status: RuleSearchStatus = searchLoading
                  ? 'pending'
                  : (searchResults[index]?.status ?? 'pending');
                return (
                  <Pressable
                    key={rule.name}
                    style={[styles.ruleTab, active && styles.ruleTabActive]}
                    onPress={() => setRuleTabIndex(index)}>
                    <Text style={[styles.ruleTabText, active && styles.ruleTabTextActive]} numberOfLines={1}>
                      {rule.name}
                    </Text>
                    <View
                      style={[styles.ruleStatusDot, { backgroundColor: getRuleStatusColor(status) }]}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          {searchLoading ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.modalLoadingText}>正在搜索全部规则…</Text>
            </View>
          ) : null}
          {roadLoading ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.modalLoadingText}>正在加载播放线路…</Text>
            </View>
          ) : null}
          <ScrollView contentContainerStyle={styles.modalList}>
            {selectedStatus === 'success'
              ? selectedSources.map((item, index) => (
                  <Pressable
                    key={`${item.src}-${index}`}
                    style={styles.sourceRow}
                    disabled={roadLoading}
                    onPress={() => {
                      if (!selectedRule) {
                        return;
                      }
                      void pickSource(selectedRule, item.src);
                    }}>
                    <Text style={styles.sourceTitle}>{item.name || '(无标题)'}</Text>
                    <Text style={styles.sourceSub} numberOfLines={2}>
                      {item.src}
                    </Text>
                  </Pressable>
                ))
              : null}
            {!searchLoading && selectedStatus !== 'success' ? (
              <View style={styles.emptySourceBox}>
                <Text style={styles.emptySource}>
                  {getRuleStatusMessage(selectedRule?.name ?? '当前规则', selectedStatus)}
                </Text>
                {selectedStatus === 'error' || selectedStatus === 'captcha' ? (
                  <Pressable style={styles.retryBtn} onPress={() => void searchAllRules()}>
                    <Text style={styles.retryBtnText}>全部重试</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {!searchLoading && selectedStatus === 'success' && selectedSources.length === 0 ? (
              <Text style={styles.emptySource}>当前规则未找到匹配源</Text>
            ) : null}
            {!searchLoading && !hasAnySuccess && installedRules.length > 0 ? (
              <Text style={styles.emptyHint}>可左右切换规则查看其他来源结果</Text>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 40,
  },
  hero: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  cover: {
    width: 108,
    height: 152,
    borderRadius: 10,
    backgroundColor: '#ddd',
  },
  coverPlaceholder: {
    backgroundColor: '#d8d8dc',
  },
  heroMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
  },
  metaLine: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  collectBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  collectBtnText: {
    fontWeight: '600',
    color: colors.text,
  },
  watchBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  watchBtnText: {
    fontWeight: '700',
    color: '#fff',
  },
  section: {
    marginTop: 18,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    color: colors.text,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  ruleTabs: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  ruleTab: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    maxWidth: 180,
  },
  ruleTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ruleTabText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
    flexShrink: 1,
  },
  ruleTabTextActive: {
    color: '#fff',
  },
  ruleStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modalLoading: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  modalLoadingText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  modalList: {
    flexGrow: 2,
    padding: 16,
    gap: 8,
  },
  sourceRow: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sourceTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  sourceSub: {
    marginTop: 4,
    fontSize: 11,
    color: colors.textSecondary,
  },
  emptySource: {
    textAlign: 'center',
    color: colors.textSecondary,
    paddingVertical: 12,
  },
  emptySourceBox: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  emptyHint: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 12,
    paddingTop: 8,
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  retryBtnText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
});
