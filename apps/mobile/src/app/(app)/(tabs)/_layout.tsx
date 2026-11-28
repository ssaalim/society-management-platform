import React from 'react';
import { Platform, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, IconName } from '@/components/ui';
import { C, F } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { isGuardOnly } from '@/lib/roles';

const TABS: { name: string; title: string; icon: IconName; active: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home-outline', active: 'home' },
  { name: 'services', title: 'Services', icon: 'construct-outline', active: 'construct' },
  { name: 'activity', title: 'Activity', icon: 'reader-outline', active: 'reader' },
  { name: 'security', title: 'Security', icon: 'shield-checkmark-outline', active: 'shield-checkmark' },
  { name: 'help', title: 'Help', icon: 'help-circle-outline', active: 'help-circle' },
];

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { society } = useAuth();
  // Security guards get the gate desk, not the resident tabs.
  if (isGuardOnly(society?.role)) return <Redirect href="/gate" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.orangeDeep,
        tabBarInactiveTintColor: '#555B66',
        tabBarLabelStyle: { fontFamily: F.regular, fontSize: 12, lineHeight: 16 },
        tabBarStyle: {
          height: 74 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 12 : 8),
          borderTopColor: C.line,
        },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ focused, color }) =>
              focused ? (
                <View style={{ backgroundColor: '#FDEBD8', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 2 }}>
                  <Ionicons name={t.active} size={22} color={color as string} />
                </View>
              ) : (
                <Ionicons name={t.icon} size={22} color={color as string} />
              ),
          }}
        />
      ))}
    </Tabs>
  );
}
