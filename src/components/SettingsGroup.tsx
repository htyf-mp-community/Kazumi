import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

type SettingsGroupProps = {
  title: string;
  children: ReactNode;
};

export function SettingsGroup({ title, children }: SettingsGroupProps) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

type SettingsItemProps = {
  title: string;
  description?: string;
  onPress: () => void;
};

export function SettingsItem({ title, description, onPress }: SettingsItemProps) {
  return (
    <Pressable style={styles.item} onPress={onPress}>
      <View style={styles.itemBody}>
        <Text style={styles.itemTitle}>{title}</Text>
        {description ? <Text style={styles.itemDesc}>{description}</Text> : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    marginTop: 16,
  },
  groupTitle: {
    marginBottom: 8,
    marginLeft: 4,
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemBody: {
    flex: 1,
    paddingRight: 8,
  },
  itemTitle: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  itemDesc: {
    marginTop: 3,
    fontSize: 12,
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: 22,
    color: '#c7c7cc',
    fontWeight: '300',
  },
});
