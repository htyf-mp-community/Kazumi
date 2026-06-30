import { useCallback, useState } from 'react';
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

import { ScreenHeader } from '@/components/ScreenHeader';
import type { RootStackParamList } from '@/navigation/types';
import {
  isBuiltinBangumiProxyEntry,
  useBangumiProxyStore,
} from '@/stores/bangumi-proxy-store';
import { colors } from '@/theme/colors';

const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
};

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function BangumiProxyScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { entries, addEntry, removeEntry, resetToDefaults } = useBangumiProxyStore();

  const [label, setLabel] = useState('');
  const [nextBaseUrl, setNextBaseUrl] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [userAgent, setUserAgent] = useState(DEFAULT_HEADERS['User-Agent']);

  const handleAdd = useCallback(() => {
    const trimmedNext = nextBaseUrl.trim();
    if (!trimmedNext) {
      Alert.alert('提示', '请填写 Next 反代地址');
      return;
    }
    if (!isValidUrl(trimmedNext)) {
      Alert.alert('提示', 'Next 反代地址格式无效');
      return;
    }
    const trimmedApi = apiBaseUrl.trim();
    if (trimmedApi && !isValidUrl(trimmedApi)) {
      Alert.alert('提示', 'API 反代地址格式无效');
      return;
    }
    addEntry({
      label: label.trim() || trimmedNext,
      nextBaseUrl: trimmedNext,
      apiBaseUrl: trimmedApi || trimmedNext,
      headers: {
        Accept: 'application/json',
        'User-Agent': userAgent.trim() || DEFAULT_HEADERS['User-Agent'],
      },
    });
    setLabel('');
    setNextBaseUrl('');
    setApiBaseUrl('');
    setUserAgent(DEFAULT_HEADERS['User-Agent']);
  }, [addEntry, apiBaseUrl, label, nextBaseUrl, userAgent]);

  const handleRemove = useCallback(
    (id: string, entryLabel: string) => {
      Alert.alert('删除反代', `确定删除「${entryLabel}」？`, [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => removeEntry(id),
        },
      ]);
    },
    [removeEntry],
  );

  const handleReset = useCallback(() => {
    Alert.alert('恢复默认', '将恢复为内置默认反代列表，自定义项会被清除。', [
      { text: '取消', style: 'cancel' },
      {
        text: '恢复',
        onPress: () => resetToDefaults(),
      },
    ]);
  }, [resetToDefaults]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="bgm.tv 反代" showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hint}>
          请求会按列表顺序依次尝试，直到某个反代返回成功。Next 用于热门/日历/详情，API 用于搜索。
        </Text>

        <Text style={styles.sectionTitle}>添加反代</Text>
        <Text style={styles.label}>名称（可选）</Text>
        <TextInput
          style={styles.input}
          value={label}
          onChangeText={setLabel}
          placeholder="例如：自建反代"
          autoCapitalize="none"
        />
        <Text style={styles.label}>Next 反代地址</Text>
        <TextInput
          style={styles.input}
          value={nextBaseUrl}
          onChangeText={setNextBaseUrl}
          placeholder="https://next.example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Text style={styles.label}>API 反代地址（可选，默认同 Next）</Text>
        <TextInput
          style={styles.input}
          value={apiBaseUrl}
          onChangeText={setApiBaseUrl}
          placeholder="https://api.example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Text style={styles.label}>User-Agent（可选）</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={userAgent}
          onChangeText={setUserAgent}
          placeholder="请求头 User-Agent"
          autoCapitalize="none"
          autoCorrect={false}
          multiline
        />
        <Pressable style={styles.primaryBtn} onPress={handleAdd}>
          <Text style={styles.primaryBtnText}>添加</Text>
        </Pressable>

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>已配置 ({entries.length})</Text>
          <Pressable onPress={handleReset}>
            <Text style={styles.resetText}>恢复默认</Text>
          </Pressable>
        </View>

        {entries.length === 0 ? (
          <Text style={styles.hint}>暂无反代配置</Text>
        ) : (
          entries.map((entry, index) => {
            const isBuiltin = isBuiltinBangumiProxyEntry(entry.id);
            return (
              <View key={entry.id} style={styles.entryRow}>
                <View style={styles.entryBody}>
                  <Text style={styles.entryTitle}>
                    {index + 1}. {entry.label}
                    {isBuiltin ? ' · 官方' : ''}
                  </Text>
                  <Text style={styles.entryMeta}>Next: {entry.nextBaseUrl}</Text>
                  <Text style={styles.entryMeta}>API: {entry.apiBaseUrl}</Text>
                </View>
                {!isBuiltin ? (
                  <Pressable
                    style={styles.deleteBtn}
                    onPress={() => handleRemove(entry.id, entry.label)}>
                    <Text style={styles.deleteBtnText}>删除</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}
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
  hint: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  listHeader: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resetText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  label: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
  },
  input: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    fontSize: 14,
  },
  inputMultiline: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  primaryBtn: {
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  entryRow: {
    marginTop: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  entryBody: {
    flex: 1,
    padding: 12,
    gap: 2,
  },
  entryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  entryMeta: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  deleteBtn: {
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  deleteBtnText: {
    color: '#ff3b30',
    fontWeight: '600',
    fontSize: 13,
  },
});
