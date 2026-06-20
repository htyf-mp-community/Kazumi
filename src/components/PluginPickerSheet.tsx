import { useCallback, useMemo, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetModal,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import type { KazumiPluginListItem } from '@/collector';

type PluginPickerSheetProps = {
  pluginList: KazumiPluginListItem[];
  selectedPlugin: string | null;
  listLoading: boolean;
  onRefresh: () => void;
  onSelect: (item: KazumiPluginListItem) => void;
};

export function PluginPickerSheet({
  pluginList,
  selectedPlugin,
  listLoading,
  onRefresh,
  onSelect,
}: PluginPickerSheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['55%', '70%'], []);

  const openSheet = useCallback(() => {
    sheetRef.current?.present();
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
      />
    ),
    [],
  );

  const handleSelect = useCallback(
    (item: KazumiPluginListItem) => {
      onSelect(item);
      sheetRef.current?.dismiss();
    },
    [onSelect],
  );

  const selectedItem = pluginList.find((item) => item.name === selectedPlugin);

  return (
    <>
      <Pressable style={styles.trigger} onPress={openSheet}>
        <View style={styles.triggerBody}>
          <Text style={styles.triggerLabel}>当前采集源</Text>
          <Text style={styles.triggerValue}>
            {selectedItem
              ? `${selectedItem.name} · v${selectedItem.version}`
              : selectedPlugin ?? '未选择'}
          </Text>
          {selectedItem ? (
            <Text style={styles.triggerMeta}>
              {selectedItem.antiCrawlerEnabled ? '反爬' : '无反爬'}
              {' · '}
              {selectedItem.useNativePlayer ? '原生播放' : 'Web 播放'}
            </Text>
          ) : null}
        </View>
        <Text style={styles.triggerAction}>切换</Text>
      </Pressable>

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.handle}
        enableDynamicSizing={false}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        enableBlurKeyboardOnGesture
        android_keyboardInputMode="adjustResize"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>KazumiRules 聚合列表</Text>
            <Text style={styles.headerSub}>
              共 {pluginList.length} 个源 · 点击切换
            </Text>
          </View>
          <Pressable
            style={styles.refreshBtn}
            disabled={listLoading}
            onPress={onRefresh}>
            {listLoading ? (
              <ActivityIndicator size="small" color="#007aff" />
            ) : (
              <Text style={styles.refreshText}>刷新</Text>
            )}
          </Pressable>
        </View>

        <BottomSheetFlatList
          data={pluginList}
          keyExtractor={(item) => item.name}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const selected = selectedPlugin === item.name;
            return (
              <Pressable
                style={[styles.row, selected && styles.rowSelected]}
                onPress={() => handleSelect(item)}>
                <Text style={styles.rowTitle}>
                  {item.name}
                  {selected ? ' ✓' : ''}
                </Text>
                <Text style={styles.rowSub}>
                  v{item.version}
                  {item.antiCrawlerEnabled ? ' · 反爬' : ''}
                  {item.useNativePlayer ? ' · 原生播放' : ''}
                </Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            listLoading ? null : (
              <Text style={styles.empty}>暂无源，请点击刷新</Text>
            )
          }
        />
      </BottomSheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e5ea',
    gap: 12,
  },
  triggerBody: {
    flex: 1,
    gap: 2,
  },
  triggerLabel: {
    fontSize: 12,
    color: '#666',
  },
  triggerValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  triggerMeta: {
    fontSize: 11,
    color: '#888',
  },
  triggerAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007aff',
  },
  handle: {
    backgroundColor: '#ccc',
    width: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  headerSub: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  refreshBtn: {
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#007aff',
  },
  refreshText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007aff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  rowSelected: {
    backgroundColor: '#eef4ff',
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  rowSub: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  empty: {
    textAlign: 'center',
    color: '#999',
    paddingVertical: 24,
    fontSize: 13,
  },
});
