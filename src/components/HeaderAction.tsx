import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '@/theme/colors';

type HeaderActionProps = {
  label: string;
  onPress: () => void;
};

export function HeaderAction({ label, onPress }: HeaderActionProps) {
  return (
    <Pressable style={styles.btn} onPress={onPress}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});
