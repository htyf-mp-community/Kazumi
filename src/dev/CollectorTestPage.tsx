import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import Video from 'react-native-video';
import { PluginPickerSheet } from '@/components/PluginPickerSheet';
import { copyToClipboard } from '@/utils/copy-to-clipboard';

import {
  buildKazumiRuleUrl,
  CollectorProvider,
  DEFAULT_RULE_URL,
  fetchKazumiPluginList,
  fetchPluginRuleFromUrl,
  type KazumiPluginListItem,
  type PluginRule,
  type PluginSearchResponse,
  type Road,
  useCollector,
} from '@/collector';

export function CollectorTestPage() {
  const { getRuleEngine } = useCollector();

  const [ruleUrl, setRuleUrl] = useState(DEFAULT_RULE_URL);
  const [keyword, setKeyword] = useState('从零开始的异世界生活');
  const [rule, setRule] = useState<PluginRule | null>(null);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState('输入规则 URL 并点击「加载规则」开始测试');
  const [searchResult, setSearchResult] = useState<PluginSearchResponse | null>(
    null,
  );
  const [searchStatus, setSearchStatus] = useState('');
  const [roads, setRoads] = useState<Road[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [pluginList, setPluginList] = useState<KazumiPluginListItem[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>('7sefun');
  const [listLoading, setListLoading] = useState(false);
  const [searchedOnce, setSearchedOnce] = useState(false);

  const appendLog = useCallback((message: string) => {
    setLog((prev) => `${message}\n${prev}`.slice(0, 6000));
  }, []);

  const copyVideoUrl = useCallback(async () => {
    if (!videoUrl) {
      return;
    }
    const ok = await copyToClipboard(videoUrl);
    appendLog(ok ? '已复制视频地址' : '复制失败');
  }, [appendLog, videoUrl]);

  const getEngine = useCallback(() => getRuleEngine(), [getRuleEngine]);

  const loadPluginList = useCallback(async () => {
    setListLoading(true);
    try {
      appendLog('加载 KazumiRules 聚合列表…');
      const list = await fetchKazumiPluginList();
      setPluginList(list);
      appendLog(`聚合列表已加载: ${list.length} 个源`);
    } catch (error) {
      setPluginList([]);
      appendLog(`聚合列表失败: ${String(error)}`);
    } finally {
      setListLoading(false);
    }
  }, [appendLog]);

  const selectPlugin = useCallback(
    (item: KazumiPluginListItem) => {
      const url = buildKazumiRuleUrl(item.name);
      setSelectedPlugin(item.name);
      setRuleUrl(url);
      setRule(null);
      setSearchResult(null);
      setSearchStatus('');
      setRoads([]);
      setVideoUrl('');
      appendLog(`已选择源: ${item.name} v${item.version} → ${url}`);
    },
    [appendLog],
  );

  useEffect(() => {
    void loadPluginList();
  }, [loadPluginList]);

  const loadRule = useCallback(async () => {
    setLoading(true);
    setSearchResult(null);
    setSearchStatus('');
    setRoads([]);
    setVideoUrl('');
    try {
      appendLog(`加载规则: ${ruleUrl.trim()}`);
      const loaded = await fetchPluginRuleFromUrl(ruleUrl);
      setRule(loaded);
      appendLog(
        `规则已加载: ${loaded.name} v${loaded.version} (api ${loaded.api})`,
      );
    } catch (error) {
      setRule(null);
      appendLog(`加载失败: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [appendLog, ruleUrl]);

  const runSearch = useCallback(async () => {
    if (!rule) {
      appendLog('请先加载规则');
      return;
    }
    setLoading(true);
    setSearchedOnce(true);
    setRoads([]);
    setVideoUrl('');
    setSearchResult(null);
    try {
      appendLog(`搜索「${keyword.trim()}」`);
      const response = await getEngine().search(rule, keyword.trim());
      setSearchResult(response);
      setSearchStatus('success');
      appendLog(`搜索成功: ${response.data.length} 条结果`);
    } catch (error) {
      setSearchStatus(
        error instanceof Error ? error.name : 'error',
      );
      appendLog(`搜索失败: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [appendLog, getEngine, keyword, rule]);

  const loadRoads = useCallback(
    async (href: string) => {
      if (!rule) {
        return;
      }
      setLoading(true);
      setVideoUrl('');
      try {
        const fullUrl = getEngine().buildEpisodeUrl(rule, href);
        appendLog(`加载线路: ${fullUrl}`);
        const list = await getEngine().fetchRoads(rule, href);
        setRoads(list);
        appendLog(
          `线路 ${list.length} 条${list[0] ? `，首线路 ${list[0].data.length} 集` : ''}`,
        );
      } catch (error) {
        appendLog(`线路失败: ${String(error)}`);
      } finally {
        setLoading(false);
      }
    },
    [appendLog, getEngine, rule],
  );

  const hasRule = Boolean(rule);
  const searchDisabled = !hasRule || loading;
  const loadRuleDisabled = loading || !ruleUrl.trim();

  const resolveEpisode = useCallback(
    async (episodeHref: string) => {
      if (!rule) {
        return;
      }
      setLoading(true);
      try {
        appendLog(`嗅探: ${episodeHref}`);
        const source = await getEngine().resolveVideo(rule, episodeHref, {
          timeoutMs: 45_000,
        });
        setVideoUrl(source.url);
        appendLog(`视频 URL: ${source.url.slice(0, 160)}`);
      } catch (error) {
        appendLog(`嗅探失败: ${String(error)}`);
      } finally {
        setLoading(false);
      }
    },
    [appendLog, getEngine, rule],
  );

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaView style={styles.safe}>
          <BottomSheetModalProvider>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.title}>Kazumi 采集引擎测试</Text>
              <Text style={styles.subtitle}>
                从 KazumiRules 聚合列表选择源，或手动输入 JSON 地址，依次测试：加载规则
                → 搜索 → 线路 → 嗅探
              </Text>

              <PluginPickerSheet
                pluginList={pluginList}
                selectedPlugin={selectedPlugin}
                listLoading={listLoading}
                onRefresh={() => void loadPluginList()}
                onSelect={selectPlugin}
              />

              <Text style={styles.label}>规则 URL</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={ruleUrl}
                onChangeText={setRuleUrl}
                placeholder="https://gh-proxy.org/https://github.com/.../AGE.json"
                autoCapitalize="none"
                autoCorrect={false}
                multiline
              />
              <Pressable
                style={[styles.btnPrimary, loadRuleDisabled && styles.btnDisabled]}
                disabled={loadRuleDisabled}
                onPress={() => void loadRule()}>
                <Text style={styles.btnText}>{loading ? '加载中...' : '加载规则'}</Text>
              </Pressable>

              {rule ? (
                <View style={styles.ruleCard}>
                  <Text style={styles.ruleTitle}>{rule.name}</Text>
                  <Text style={styles.ruleMeta}>
                    v{rule.version} · api {rule.api} · {rule.baseUrl}
                  </Text>
                  <Text style={styles.ruleMeta}>
                    legacy={String(rule.useLegacyParser)} · post=
                    {String(rule.usePost)}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.label}>搜索关键词</Text>
              <TextInput
                style={styles.input}
                value={keyword}
                onChangeText={setKeyword}
                placeholder="番剧名"
                autoCapitalize="none"
              />
              <Pressable
                style={[styles.btnPrimary, searchDisabled && styles.btnDisabled]}
                disabled={searchDisabled}
                onPress={() => void runSearch()}>
                <Text style={styles.btnText}>{loading ? '搜索中...' : '搜索'}</Text>
              </Pressable>

              {loading ? <ActivityIndicator style={styles.loader} /> : null}

              {searchResult ? (
                <View style={styles.block}>
                  <Text style={styles.blockTitle}>
                    搜索结果 · {searchStatus || 'success'} ·{' '}
                    {searchResult.data.length} 条
                  </Text>
                  {searchResult.data.slice(0, 8).map((item, index) => (
                    <Pressable
                      key={`search-${index}`}
                      style={styles.row}
                      onPress={() => void loadRoads(item.src)}>
                      <Text style={styles.rowTitle}>{item.name || '(无标题)'}</Text>
                      <Text style={styles.rowSub} numberOfLines={2}>
                        {item.src}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {!loading && searchedOnce && !searchResult ? (
                <View style={styles.tipBox}>
                  <Text style={styles.tipText}>
                    没有命中结果，换关键词试试，或检查当前规则是否可用。
                  </Text>
                </View>
              ) : null}

              {roads.map((road, roadIndex) => (
                <View key={`road-${roadIndex}`} style={styles.block}>
                  <Text style={styles.blockTitle}>
                    {road.name} ({road.data.length} 集)
                  </Text>
                  {road.data.slice(0, 10).map((href, episodeIndex) => (
                    <Pressable
                      key={`${roadIndex}-${episodeIndex}`}
                      style={styles.row}
                      onPress={() => void resolveEpisode(href)}>
                      <Text style={styles.rowTitle}>
                        {road.identifier[episodeIndex] ?? `第 ${episodeIndex + 1} 集`}
                      </Text>
                      <Text style={styles.rowSub} numberOfLines={2}>
                        {href}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ))}

              {!loading && searchResult && roads.length === 0 ? (
                <View style={styles.tipBox}>
                  <Text style={styles.tipText}>
                    点击任意搜索结果可加载播放线路。
                  </Text>
                </View>
              ) : null}

              {videoUrl ? (
                <View style={styles.videoBox}>
                  <View style={styles.videoUrlHeader}>
                    <Text style={styles.blockTitle}>嗅探结果</Text>
                    <Pressable style={styles.btnGhost} onPress={() => void copyVideoUrl()}>
                      <Text style={styles.btnGhostText}>复制</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.videoUrl} selectable>
                    {videoUrl}
                  </Text>
                  <Video controls source={{ uri: videoUrl }} style={{ width: '100%', height: 200, backgroundColor: '#000' }} />
                </View>
              ) : null}

              <View style={styles.logHeader}>
                <Text style={styles.label}>日志</Text>
                <Pressable
                  style={styles.btnGhost}
                  onPress={() => setLog('已清空日志')}>
                  <Text style={styles.btnGhostText}>清空</Text>
                </Pressable>
              </View>
              <Text style={styles.log} selectable>
                {log}
              </Text>
            </ScrollView>
          </BottomSheetModalProvider>
        </SafeAreaView>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
    backgroundColor: '#f2f2f7',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  btnPrimary: {
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#007aff',
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.45,
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  ruleCard: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#e8f1ff',
    gap: 4,
  },
  ruleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#003d99',
  },
  ruleMeta: {
    fontSize: 12,
    color: '#335',
  },
  loader: {
    marginVertical: 8,
  },
  tipBox: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#fff4e5',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ffd29d',
  },
  tipText: {
    color: '#8a5200',
    fontSize: 12,
  },
  block: {
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e5ea',
  },
  blockTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  row: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  rowTitle: {
    fontSize: 14,
    color: '#000',
  },
  rowSub: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  videoBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#e8f5e9',
  },
  videoUrlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  videoUrl: {
    fontSize: 11,
    fontFamily: 'Menlo',
    color: '#1b5e20',
  },
  logHeader: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  btnGhost: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#c8c7cc',
    backgroundColor: '#fff',
  },
  btnGhostText: {
    fontSize: 12,
    color: '#444',
    fontWeight: '500',
  },
  log: {
    minHeight: 120,
    fontSize: 11,
    fontFamily: 'Menlo',
    color: '#333',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
  },
});
