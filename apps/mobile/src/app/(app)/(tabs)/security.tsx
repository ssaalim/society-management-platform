import React from 'react';
import { Linking, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Body, Button, Card, Header, IconBubble, IconName, SectionTitle, T } from '@/components/ui';
import { useApi } from '@/lib/use-api';
import { useAuth } from '@/lib/auth';
import { canUseGate } from '@/lib/roles';
import { C, timeOf } from '@/lib/theme';

export default function Security() {
  const { society } = useAuth();
  const visitors = useApi<{ visits: any[] }>('/visitors/mine');
  const pending = (visitors.data?.visits || []).filter((v) => v.status === 'PENDING' && !v.noResponse);
  const inside = (visitors.data?.visits || []).filter((v) => v.status === 'INSIDE');

  const rows: { icon: IconName; color: string; title: string; hint: string; onPress: () => void }[] = [
    { icon: 'people-outline', color: '#5B7CFA', title: 'My visitors', hint: 'Approve, decline, history', onPress: () => router.push('/visitors') },
    { icon: 'qr-code-outline', color: C.orangeDeep, title: 'Guest passes', hint: 'Pre-approve a guest with a code', onPress: () => router.push('/passes') },
    ...(canUseGate(society?.role)
      ? [{ icon: 'shield-outline' as IconName, color: C.green, title: 'Gate desk', hint: 'Log visitors, check codes, entry and exit', onPress: () => router.push('/gate') }]
      : []),
  ];

  return (
    <View style={{ flex: 1 }}>
      <Header title="Security" back={false} />
      <Body loading={visitors.loading && !visitors.data} error={visitors.error} onRefresh={visitors.reload}>
        {pending.length > 0 && (
          <Card style={{ backgroundColor: C.purpleSoft, borderColor: '#DCD5FB', gap: 10 }}>
            <T weight="medium">
              {pending.length} visitor{pending.length === 1 ? '' : 's'} waiting at the gate
            </T>
            {pending.slice(0, 3).map((v) => (
              <Pressable key={v.id} onPress={() => router.push({ pathname: '/visitors/[id]', params: { id: v.id } })} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T>
                  {v.name} · {v.typeLabel}
                </T>
                <T style={{ color: C.sub }}>{timeOf(v.entryTime)}</T>
              </Pressable>
            ))}
            <Button label="Review" small onPress={() => router.push('/visitors')} />
          </Card>
        )}
        {inside.length > 0 && (
          <Card style={{ gap: 6 }}>
            <T weight="medium">Inside now</T>
            {inside.map((v) => (
              <View key={v.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T>{v.name}</T>
                <Badge label={`since ${timeOf(v.enteredAt || v.entryTime)}`} tone="green" />
              </View>
            ))}
          </Card>
        )}
        {rows.map((r) => (
          <Card key={r.title} onPress={r.onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconBubble name={r.icon} color={r.color} bg={C.card} size={44} />
            <View style={{ flex: 1 }}>
              <T weight="medium">{r.title}</T>
              <T style={{ color: C.sub, fontSize: 13 }}>{r.hint}</T>
            </View>
          </Card>
        ))}
        <SectionTitle>Emergency</SectionTitle>
        <Card style={{ gap: 10, backgroundColor: C.redSoft, borderColor: '#F8C9CB' }}>
          <T style={{ color: C.text }}>In an emergency call 112. The SOS button that alerts the gate and committee is coming soon.</T>
          <Button label="Call 112" icon="call" onPress={() => Linking.openURL('tel:112')} />
        </Card>
      </Body>
    </View>
  );
}
