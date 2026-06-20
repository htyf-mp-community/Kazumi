import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CollectorProvider } from '@/collector';
import { RootNavigator } from '@/navigation/RootNavigator';

export function App() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <CollectorProvider>
          <BottomSheetModalProvider>
            <RootNavigator />
          </BottomSheetModalProvider>
        </CollectorProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

export default App;
