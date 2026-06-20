import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { useCollector, type PluginRule } from '@/collector';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';

export function PluginTestScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'PluginTest'>>();
  const { getRuleEngine } = useCollector();

  const rule: PluginRule = route.params.rule;
  const [keyword, setKeyword] = useState('从零开始的异世界生活');
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState('输入关键词后点击「搜索测试」');

  const appendLog = useCallback((message: string) => {
    setLog((prev) => `${message}\n${prev}`.slice(0, 4000));
  }, []);

  const runSearch = useCallback(async () => {
    setLoading(true);
    try {
      appendLog(`[${rule.name}] 搜索「${keyword.trim()}」`);
      const response = await getRuleEngine().search(rule, keyword.trim());
      appendLog(`成功: ${response.data.length} 条结果`);
      response.data.slice(0, 5).forEach((item, index) => {
        appendLog(`${index + 1}. ${item.name} → ${item.src}`);
      });
    } catch (error) {
      appendLog(`失败: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [appendLog, getRuleEngine, keyword, rule]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="规则测试"
        subtitle={`${rule.name} · v${rule.version}`}
        showBack
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>搜索关键词</Text>
        <TextInput
          style={styles.input}
          value={keyword}
          onChangeText={setKeyword}
          placeholder="番剧名"
          autoCapitalize="none"
        />
        <Pressable
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          disabled={loading}
          onPress={() => void runSearch()}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>搜索测试</Text>
          )}
        </Pressable>
        <Text style={styles.logTitle}>日志</Text>
        <Text style={styles.log} selectable>
          {log}
        </Text>
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
  label: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    fontSize: 14,
  },
  primaryBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  logTitle: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  log: {
    minHeight: 180,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    fontSize: 11,
    fontFamily: 'Menlo',
    color: colors.text,
  },
});
