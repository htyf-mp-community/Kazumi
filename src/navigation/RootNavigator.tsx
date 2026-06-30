import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { TabNavigator } from '@/navigation/TabNavigator';
import type { RootStackParamList } from '@/navigation/types';
import { HistoryScreen } from '@/screens/HistoryScreen';
import { InfoScreen } from '@/screens/InfoScreen';
import { PlayerScreen } from '@/screens/PlayerScreen';
import { PluginEditorScreen } from '@/screens/PluginEditorScreen';
import { BangumiProxyScreen } from '@/screens/BangumiProxyScreen';
import { PluginManageScreen } from '@/screens/PluginManageScreen';
import { PluginTestScreen } from '@/screens/PluginTestScreen';
import { SearchScreen } from '@/screens/SearchScreen';
import { colors } from '@/theme/colors';

const Stack = createStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="MainTabs" component={TabNavigator} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="Info" component={InfoScreen} />
        <Stack.Screen name="PluginManage" component={PluginManageScreen} />
        <Stack.Screen name="BangumiProxy" component={BangumiProxyScreen} />
        <Stack.Screen name="PluginEditor" component={PluginEditorScreen} />
        <Stack.Screen name="PluginTest" component={PluginTestScreen} />
        <Stack.Screen
          name="Player"
          component={PlayerScreen}
          options={{ gestureEnabled: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
