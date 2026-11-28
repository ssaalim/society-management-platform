import { Stack } from 'expo-router';

/** Everything a signed-in resident sees: the tabs, with detail screens pushed over them. */
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fff' } }} />;
}
