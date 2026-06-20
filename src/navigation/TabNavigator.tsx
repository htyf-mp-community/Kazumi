import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { CollectScreen } from '@/screens/CollectScreen';
import { MyScreen } from '@/screens/MyScreen';
import { PopularScreen } from '@/screens/PopularScreen';
import { TimelineScreen } from '@/screens/TimelineScreen';
import type { TabParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';

const Tab = createBottomTabNavigator<TabParamList>();

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: focused ? '700' : '500',
        color: focused ? colors.primary : colors.textSecondary,
      }}>
      {label}
    </Text>
  );
}

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}>
      <Tab.Screen
        name="Popular"
        component={PopularScreen}
        options={{
          tabBarLabel: ({ focused }) => <TabLabel label="推荐" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Timeline"
        component={TimelineScreen}
        options={{
          tabBarLabel: ({ focused }) => <TabLabel label="时间表" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Collect"
        component={CollectScreen}
        options={{
          tabBarLabel: ({ focused }) => <TabLabel label="追番" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="My"
        component={MyScreen}
        options={{
          tabBarLabel: ({ focused }) => <TabLabel label="我的" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}
