import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar, Badge, Body, Button, Card, Empty, Header, Ionicons, SearchBox, Segmented, T } from '@/components/ui';
import { Visit, decide, visitStatus, visitTab } from '@/components/visitors';
import { useApi } from '@/lib/use-api';
import { C, shortDate, timeOf } from '@/lib/theme';

export default function Visitors() {
  const { data, error, loading, reload } = useApi<{ visits: Visit[] }>('/visitors/mine');
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'upcoming' | 'past' | 'declined'>('upcoming');
  const [busy, setBusy] = useState(false);
  const visits = (data?.visits || []).filter((v) => !q.trim() || `${v.name} ${v.purpose || ''} ${v.typeLabel}`.toLowerCase().includes(q.trim().toLowerCase()));
  const requests = visits.filter((v) => v.status === 'PENDING' && !v.noResponse);
  const first = requests[0];
  const list = visits.filter((v) => visitTab(v) === tab && v.id !== first?.id);

  const act = async (approve: boolean) => {
    if (!first) return;
    setBusy(true);
    if (await decide(first.id, approve)) await reload();
    setBusy(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="My Visitors">
        <SearchBox placeholder="Search for Visitor" value={q} onChangeText={setQ} />
      </Header>
      <Body loading={loading && !data} error={error} onRefresh={reload}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <T weight="medium" style={{ fontSize: 16 }}>
              Visitor Request
            </T>
            {requests.length > 0 && (
              <View style={{ backgroundColor: C.orange, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', marginTop: -8, paddingHorizontal: 5 }}>
                <T style={{ color: '#fff', fontSize: 11 }}>{requests.length}</T>
              </View>
            )}
          </View>
          <T style={{ color: C.sub, textDecorationLine: 'underline', fontSize: 13 }} onPress={() => router.push('/passes')}>
            Guest passes
          </T>
        </View>
        {first ? (
          <LinearGradient colors={['#ECE8FC', '#E8EEFB']} style={{ borderRadius: 14, padding: 12, flexDirection: 'row', gap: 12 }}>
            <View style={{ width: 120, borderRadius: 10, backgroundColor: '#D9D2F8', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="person" size={64} color="#8F80E8" />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <T style={{ color: C.sub, fontSize: 12 }}>Name :</T>
              <T weight="medium">{first.name}</T>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <T style={{ color: C.sub, fontSize: 12 }}>Date :</T>
                  <T weight="medium">{shortDate(first.entryTime)}</T>
                </View>
                <View style={{ flex: 1 }}>
                  <T style={{ color: C.sub, fontSize: 12 }}>Time :</T>
                  <T weight="medium">{timeOf(first.entryTime)}</T>
                </View>
              </View>
              <T style={{ color: C.sub, fontSize: 12 }}>Purpose :</T>
              <T weight="medium" numberOfLines={2}>
                {first.purpose || first.typeLabel}
              </T>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <Button label="Approve" small style={{ flex: 1 }} busy={busy} onPress={() => act(true)} />
                <Button label="Decline" small variant="outline" style={{ flex: 1 }} disabled={busy} onPress={() => act(false)} />
              </View>
            </View>
          </LinearGradient>
        ) : (
          <Card style={{ backgroundColor: C.card }}>
            <T style={{ color: C.sub }}>No one is waiting at the gate for you.</T>
          </Card>
        )}

        <Segmented
          tone="purple"
          value={tab}
          onChange={setTab}
          options={[
            { key: 'upcoming', label: 'Upcoming' },
            { key: 'past', label: 'Past' },
            { key: 'declined', label: 'Declined' },
          ]}
        />
        {data && !list.length && <Empty icon="people-outline" text="No visitors here." />}
        {list.map((v) => {
          const st = visitStatus(v);
          return (
            <Card key={v.id} onPress={() => router.push({ pathname: '/visitors/[id]', params: { id: v.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFCF6' }}>
              <Avatar name={v.name} size={56} />
              <View style={{ flex: 1, gap: 2 }}>
                <T style={{ fontSize: 17 }}>{v.name}</T>
                <T style={{ color: C.sub }}>{v.purpose || v.typeLabel}</T>
                <Badge label={st.label} tone={st.tone} />
              </View>
              <View style={{ alignItems: 'center', gap: 2 }}>
                <Ionicons name="time-outline" size={24} color={C.orange} />
                <T style={{ fontSize: 13 }}>{timeOf(v.enteredAt || v.entryTime)}</T>
                <T style={{ fontSize: 11, color: C.sub }}>{shortDate(v.entryTime)}</T>
              </View>
            </Card>
          );
        })}
      </Body>
    </View>
  );
}
