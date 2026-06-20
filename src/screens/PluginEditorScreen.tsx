import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import {
  CaptchaDetectType,
  CaptchaType,
  PLUGIN_API_LEVEL,
  type PluginRule,
} from '@/collector';
import {
  ChipPicker,
  FormField,
  FormSection,
  SwitchField,
} from '@/components/RuleEditorFields';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { RootStackParamList } from '@/navigation/types';
import { usePluginStore } from '@/stores/plugin-store';
import { colors } from '@/theme/colors';

function patchRule(rule: PluginRule, patch: Partial<PluginRule>): PluginRule {
  return { ...rule, ...patch };
}

export function PluginEditorScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'PluginEditor'>>();
  const saveRule = usePluginStore((s) => s.saveRule);

  const previousName = route.params.previousName ?? route.params.rule.name;
  const [draft, setDraft] = useState<PluginRule>(() => ({ ...route.params.rule }));

  const update = useCallback((patch: Partial<PluginRule>) => {
    setDraft((prev) => patchRule(prev, patch));
  }, []);

  const updateAntiCrawler = useCallback(
    (patch: Partial<PluginRule['antiCrawlerConfig']>) => {
      setDraft((prev) => ({
        ...prev,
        antiCrawlerConfig: { ...prev.antiCrawlerConfig, ...patch },
      }));
    },
    [],
  );

  const captchaTypeOptions = useMemo(
    () => [
      { value: CaptchaType.imageCaptcha, label: '图片验证码' },
      { value: CaptchaType.autoClickButton, label: '自动点击' },
      { value: CaptchaType.customJavaScript, label: '自定义 JS' },
    ],
    [],
  );

  const captchaDetectOptions = useMemo(
    () => [
      { value: CaptchaDetectType.xpath, label: 'XPath' },
      { value: CaptchaDetectType.text, label: '文本' },
      { value: CaptchaDetectType.regex, label: '正则' },
    ],
    [],
  );

  const handleSave = useCallback(() => {
    if (!draft.name.trim()) {
      Alert.alert('保存失败', 'Name 不能为空');
      return;
    }
    const api = Number.parseInt(draft.api, 10);
    if (Number.isFinite(api) && api > PLUGIN_API_LEVEL) {
      Alert.alert(
        '兼容性提示',
        `规则 API ${draft.api} 高于当前客户端 ${PLUGIN_API_LEVEL}，仍要保存吗？`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '保存',
            onPress: () => {
              saveRule(draft, previousName);
              navigation.goBack();
            },
          },
        ],
      );
      return;
    }
    saveRule(draft, previousName);
    navigation.goBack();
  }, [draft, navigation, previousName, saveRule]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="规则编辑器"
        subtitle={previousName !== draft.name ? `原名称 ${previousName}` : draft.name}
        showBack
        onBack={() => navigation.goBack()}
        right={
          <>
            <Pressable
              style={styles.headerBtn}
              onPress={() => navigation.navigate('PluginTest', { rule: draft })}>
              <Text style={styles.headerBtnText}>测试</Text>
            </Pressable>
            <Pressable style={[styles.headerBtn, styles.headerBtnPrimary]} onPress={handleSave}>
              <Text style={[styles.headerBtnText, styles.headerBtnPrimaryText]}>保存</Text>
            </Pressable>
          </>
        }
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FormSection title="基本信息">
          <FormField label="Name" value={draft.name} onChangeText={(name) => update({ name })} />
          <FormField
            label="Version"
            value={draft.version}
            onChangeText={(version) => update({ version })}
          />
          <FormField
            label="BaseURL"
            value={draft.baseUrl}
            onChangeText={(baseUrl) => update({ baseUrl })}
            placeholder="https://example.com/"
          />
          <FormField
            label="SearchURL"
            value={draft.searchURL}
            onChangeText={(searchURL) => update({ searchURL })}
            placeholder="https://example.com/search?wd=@keyword"
            helper="使用 @keyword 作为搜索词占位符"
          />
        </FormSection>

        <FormSection title="XPath 规则">
          <FormField
            label="SearchList"
            value={draft.searchList}
            onChangeText={(searchList) => update({ searchList })}
            multiline
          />
          <FormField
            label="SearchName"
            value={draft.searchName}
            onChangeText={(searchName) => update({ searchName })}
            multiline
          />
          <FormField
            label="SearchResult"
            value={draft.searchResult}
            onChangeText={(searchResult) => update({ searchResult })}
            multiline
          />
          <FormField
            label="ChapterRoads"
            value={draft.chapterRoads}
            onChangeText={(chapterRoads) => update({ chapterRoads })}
            multiline
          />
          <FormField
            label="ChapterResult"
            value={draft.chapterResult}
            onChangeText={(chapterResult) => update({ chapterResult })}
            multiline
          />
        </FormSection>

        <FormSection title="高级选项" collapsible defaultOpen={false}>
          <FormField label="API" value={draft.api} onChangeText={(api) => update({ api })} />
          <FormField label="Type" value={draft.type} onChangeText={(type) => update({ type })} />
          <FormField
            label="UserAgent"
            value={draft.userAgent}
            onChangeText={(userAgent) => update({ userAgent })}
            helper="留空则使用随机 UA"
          />
          <FormField
            label="Referer"
            value={draft.referer}
            onChangeText={(referer) => update({ referer })}
          />
          <SwitchField
            label="MuliSources"
            value={draft.muliSources}
            onValueChange={(muliSources) => update({ muliSources })}
          />
          <SwitchField
            label="UseWebview"
            value={draft.useWebview}
            onValueChange={(useWebview) => update({ useWebview })}
          />
          <SwitchField
            label="UseNativePlayer"
            value={draft.useNativePlayer}
            onValueChange={(useNativePlayer) => update({ useNativePlayer })}
          />
          <SwitchField
            label="UsePost"
            value={draft.usePost}
            onValueChange={(usePost) => update({ usePost })}
          />
          <SwitchField
            label="UseLegacyParser"
            value={draft.useLegacyParser}
            onValueChange={(useLegacyParser) => update({ useLegacyParser })}
          />
          <SwitchField
            label="AdBlocker"
            value={draft.adBlocker}
            onValueChange={(adBlocker) => update({ adBlocker })}
          />
        </FormSection>

        <FormSection title="反反爬虫" collapsible defaultOpen={false}>
          <SwitchField
            label="启用反反爬虫"
            value={draft.antiCrawlerConfig.enabled}
            onValueChange={(enabled) => updateAntiCrawler({ enabled })}
          />
          {draft.antiCrawlerConfig.enabled ? (
            <>
              <ChipPicker
                label="验证类型"
                value={draft.antiCrawlerConfig.captchaType}
                options={captchaTypeOptions}
                onChange={(captchaType) => updateAntiCrawler({ captchaType })}
              />
              <ChipPicker
                label="验证页检测方式"
                value={draft.antiCrawlerConfig.captchaDetectType}
                options={captchaDetectOptions}
                onChange={(captchaDetectType) => updateAntiCrawler({ captchaDetectType })}
              />
              <FormField
                label="CaptchaDetectValue"
                value={draft.antiCrawlerConfig.captchaDetectValue}
                onChangeText={(captchaDetectValue) => updateAntiCrawler({ captchaDetectValue })}
                multiline
              />
              {draft.antiCrawlerConfig.captchaType === CaptchaType.imageCaptcha ? (
                <>
                  <FormField
                    label="CaptchaImage (XPath)"
                    value={draft.antiCrawlerConfig.captchaImage}
                    onChangeText={(captchaImage) => updateAntiCrawler({ captchaImage })}
                    multiline
                  />
                  <FormField
                    label="CaptchaInput (XPath)"
                    value={draft.antiCrawlerConfig.captchaInput}
                    onChangeText={(captchaInput) => updateAntiCrawler({ captchaInput })}
                    multiline
                  />
                </>
              ) : null}
              {draft.antiCrawlerConfig.captchaType !== CaptchaType.customJavaScript ? (
                <FormField
                  label={
                    draft.antiCrawlerConfig.captchaType === CaptchaType.imageCaptcha
                      ? 'CaptchaButton (XPath)'
                      : 'VerifyButton (XPath)'
                  }
                  value={draft.antiCrawlerConfig.captchaButton}
                  onChangeText={(captchaButton) => updateAntiCrawler({ captchaButton })}
                  multiline
                />
              ) : null}
              {draft.antiCrawlerConfig.captchaType === CaptchaType.customJavaScript ? (
                <FormField
                  label="CaptchaScript (JavaScript)"
                  value={draft.antiCrawlerConfig.captchaScript}
                  onChangeText={(captchaScript) => updateAntiCrawler({ captchaScript })}
                  multiline
                  helper="脚本可调用 KazumiCaptcha.log/clicked/done/fail"
                />
              ) : null}
            </>
          ) : null}
        </FormSection>
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
    paddingBottom: 40,
  },
  headerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerBtnPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  headerBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  headerBtnPrimaryText: {
    color: '#fff',
  },
});
