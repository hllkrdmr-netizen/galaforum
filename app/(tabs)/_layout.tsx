import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '../../components/navigation/TabBar';
import { colors } from '../../constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Gündem' }} />
      <Tabs.Screen name="mac" options={{ title: 'Maç' }} />
      <Tabs.Screen name="transfer" options={{ title: 'Transfer' }} />
      <Tabs.Screen name="topluluk" options={{ title: 'Topluluk' }} />
      <Tabs.Screen name="daha" options={{ title: 'Daha' }} />
    </Tabs>
  );
}
