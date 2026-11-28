import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, useFonts } from '@expo-google-fonts/poppins';
import { AuthProvider, useAuth } from '@/lib/auth';
import { C } from '@/lib/theme';

function Root() {
  const { ready, user } = useAuth();
  const [fonts] = useFonts({ Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold });
  if (!ready || !fonts) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.header }}>
        <ActivityIndicator color={C.orange} />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fff' } }}>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" />
        <Stack.Screen name="activate" />
      </Stack.Protected>
      <Stack.Protected guard={!!user} redirectTo="/login">
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
