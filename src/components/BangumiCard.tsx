import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import type { BangumiItem } from '@/types/bangumi';
import { getBangumiCover, getDisplayName, getSecondaryName } from '@/types/bangumi';

type BangumiCardProps = {
  item: BangumiItem;
  onPress: () => void;
  subtitle?: string;
  compact?: boolean;
};

export function BangumiCard({ item, onPress, subtitle, compact }: BangumiCardProps) {
  const cover = getBangumiCover(item);
  const title = getDisplayName(item);
  const resolvedSubtitle = subtitle ?? getSecondaryName(item) ?? undefined;

  return (
    <Pressable style={[styles.card, compact && styles.cardCompact]} onPress={onPress}>
      <View style={[styles.coverWrap, compact && styles.coverWrapCompact]}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Text style={styles.placeholderText}>无封面</Text>
          </View>
        )}
        {item.ratingScore > 0 ? (
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreText}>{item.ratingScore.toFixed(1)}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      {resolvedSubtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {resolvedSubtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 6,
  },
  cardCompact: {
    margin: 4,
  },
  coverWrap: {
    borderRadius: 10,
    overflow: 'hidden',
    aspectRatio: 3 / 4,
    backgroundColor: '#ddd',
  },
  coverWrapCompact: {
    aspectRatio: 16 / 9,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d8d8dc',
  },
  placeholderText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  scoreBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    backgroundColor: colors.cardOverlay,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  scoreText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textSecondary,
  },
});
