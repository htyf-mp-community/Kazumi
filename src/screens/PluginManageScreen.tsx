import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import {
  buildKazumiRuleUrl,
  createEmptyPluginRule,
  fetchKazumiPluginList,
  type KazumiPluginListItem,
} from '@/collector';
import { PluginPickerSheet } from '@/components/PluginPickerSheet';
import { LoadingView } from '@/components/LoadingView';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { RootStackParamList } from '@/navigation/types';
import { usePluginStore } from '@/stores/plugin-store';
import { colors } from '@/theme/colors';

export function PluginManageScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const {
    activeRule,
    installedRules,
    loading,
    loadRuleFromUrl,
    loadRuleByName,
    setActiveRule,
    removeRule,
  } = usePluginStore();

  const [ruleUrl, setRuleUrl] = useState('');
  const [pluginList, setPluginList] = useState<KazumiPluginListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(
    activeRule?.name ?? null,
  );

  const refreshCatalog = useCallback(async () => {
    setListLoading(true);
    try {
      setPluginList(await fetchKazumiPluginList());
    } catch (error) {
      Alert.alert('加载失败', String(error));
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  useEffect(() => {
    setSelectedPlugin(activeRule?.name ?? null);
  }, [activeRule?.name]);

  const handleSelectPlugin = useCallback(
    async (item: KazumiPluginListItem) => {
      try {
        await loadRuleByName(item.name);
        setSelectedPlugin(item.name);
        setRuleUrl(buildKazumiRuleUrl(item.name));
      } catch (error) {
        Alert.alert('导入失败', String(error));
      }
    },
    [loadRuleByName],
  );

  const handleLoadUrl = useCallback(async () => {
    const url = ruleUrl.trim();
    if (!url) {
      return;
    }
    try {
      await loadRuleFromUrl(url);
    } catch (error) {
      Alert.alert('加载失败', String(error));
    }
  }, [loadRuleFromUrl, ruleUrl]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="规则管理" showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.toolbar}>
          <Pressable
            style={styles.toolbarBtn}
            onPress={() =>
              navigation.navigate('PluginEditor', {
                rule: createEmptyPluginRule(),
                previousName: '',
              })
            }>
            <Text style={styles.toolbarBtnText}>新建规则</Text>
          </Pressable>
        </View>

        <PluginPickerSheet
          pluginList={pluginList}
          selectedPlugin={selectedPlugin}
          listLoading={listLoading}
          onRefresh={() => void refreshCatalog()}
          onSelect={(item) => void handleSelectPlugin(item)}
        />

        <Text style={styles.label}>规则 URL</Text>
        <TextInput
          style={styles.input}
          value={ruleUrl}
          onChangeText={setRuleUrl}
          placeholder="https://github.com/.../规则.json"
          autoCapitalize="none"
          multiline
        />
        <Pressable
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          disabled={loading}
          onPress={() => void handleLoadUrl()}>
          <Text style={styles.primaryBtnText}>{loading ? '加载中…' : '加载规则'}</Text>
        </Pressable>

        {activeRule ? (
          <View style={styles.activeCard}>
            <Text style={styles.activeTitle}>当前启用 · {activeRule.name}</Text>
            <Text style={styles.activeMeta}>
              v{activeRule.version} · api {activeRule.api}
            </Text>
            <Text style={styles.activeMeta}>{activeRule.baseUrl}</Text>
          </View>
        ) : (
          <Text style={styles.hint}>尚未加载可用规则，播放与选源功能需要先导入规则。</Text>
        )}

        <Text style={styles.sectionTitle}>已安装规则</Text>
        {installedRules.length === 0 ? (
          <Text style={styles.hint}>暂无本地规则</Text>
        ) : (
          installedRules.map((item) => {
            const active = item.name === activeRule?.name;
            return (
              <View key={item.name} style={styles.ruleRow}>
                <Pressable
                  style={styles.ruleBody}
                  onPress={() => setActiveRule(item)}
                  onLongPress={() =>
                    Alert.alert(item.name, undefined, [
                      {
                        text: '编辑',
                        onPress: () =>
                          navigation.navigate('PluginEditor', {
                            rule: item,
                            previousName: item.name,
                          }),
                      },
                      {
                        text: '测试',
                        onPress: () => navigation.navigate('PluginTest', { rule: item }),
                      },
                      {
                        text: '删除',
                        style: 'destructive',
                        onPress: () => removeRule(item.name),
                      },
                      { text: '取消', style: 'cancel' },
                    ])
                  }>
                  <Text style={styles.ruleName}>
                    {item.name}
                    {active ? ' · 当前' : ''}
                  </Text>
                  <Text style={styles.ruleMeta}>
                    v{item.version} · {item.baseUrl}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.editBtn}
                  onPress={() =>
                    navigation.navigate('PluginEditor', {
                      rule: item,
                      previousName: item.name,
                    })
                  }>
                  <Text style={styles.editBtnText}>编辑</Text>
                </Pressable>
              </View>
            );
          })
        )}
        {loading ? <LoadingView label="处理规则中…" /> : null}
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
    gap: 8,
  },
  toolbar: {
    flexDirection: 'row',
    gap: 8,
  },
  toolbarBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  toolbarBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  label: {
    marginTop: 8,
    fontSize: 13,
    color: colors.textSecondary,
  },
  input: {
    minHeight: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  primaryBtn: {
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  activeCard: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.infoBg,
    gap: 4,
  },
  activeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#003d99',
  },
  activeMeta: {
    fontSize: 12,
    color: '#335',
  },
  sectionTitle: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  hint: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  ruleRow: {
    marginTop: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  ruleBody: {
    flex: 1,
    padding: 12,
  },
  editBtn: {
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  editBtnText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  ruleName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  ruleMeta: {
    marginTop: 4,
    fontSize: 11,
    color: colors.textSecondary,
  },
});
