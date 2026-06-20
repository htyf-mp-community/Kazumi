import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import jssdk from '@htyf-mp/js-sdk';

import { colors } from '@/theme/colors';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  large?: boolean;
};

export function ScreenHeader({
  title,
  subtitle,
  showBack,
  onBack,
  right,
  large,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const menuButton = useMemo(() => {
    return jssdk.getMenuButtonBoundingClientRect();
  }, []);

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + 8,
          paddingRight: menuButton ? menuButton.right + menuButton.width : 0,
        },
      ]}>
      <View style={styles.row}>
        {showBack ? (
          <Pressable style={styles.backBtn} onPress={onBack}>
            <Text style={styles.backText}>返回</Text>
          </Pressable>
        ) : (
          <View style={styles.backPlaceholder} />
        )}
        <View style={styles.right}>{right}</View>
      </View>
      <Text style={[styles.title, large && styles.titleLarge]}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.background,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  backBtn: {
    paddingVertical: 6,
    paddingRight: 12,
  },
  backText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  backPlaceholder: {
    width: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },
  titleLarge: {
    fontSize: 28,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
  },
});
