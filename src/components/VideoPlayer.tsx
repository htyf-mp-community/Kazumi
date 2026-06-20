import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Video from 'react-native-video';
type VideoPlayerProps = {
  uri: string;
};

export function VideoPlayer({ uri }: VideoPlayerProps) {
  const source = useMemo(() => ({ uri: uri.trim() }), [uri]);

  if (!source.uri) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Video
        key={source.uri}
        source={source}
        style={styles.player}
        controls
        resizeMode="contain"
        paused={false}
        ignoreSilentSwitch="ignore"
        playInBackground={false}
        playWhenInactive={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  player: {
    flex: 1,
  },
});
