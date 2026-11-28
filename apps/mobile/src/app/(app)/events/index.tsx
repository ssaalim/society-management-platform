import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Badge, Body, Card, Empty, Header, Ionicons, Segmented, T } from '@/components/ui';
import { useApi } from '@/lib/use-api';
import { C, shortDate, timeOf } from '@/lib/theme';

export interface MeetingRow {
  id: string;
  title: string;
  typeLabel: string;
  scheduledAt: string;
  location: string;
  status: string;
  myRsvp: string | null;
  openVotes: number;
}

const GRADS: [string, string][] = [
  ['#2B2350', '#5B3B8C'],
  ['#1F3B5B', '#2E6A8E'],
  ['#4A2B2B', '#8C4A3B'],
];

/** Society events. For now these are meetings (AGM, SGM, committee) — notices, RSVP and voting. */
export default function Events() {
  const { data, error, loading, reload } = useApi<MeetingRow[]>('/meetings');
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const now = Date.now();
  const rows = (data || []).filter((m) => m.status !== 'DRAFT');
  const upcoming = rows.filter((m) => new Date(m.scheduledAt).getTime() >= now - 3 * 3600_000 && m.status !== 'CANCELLED').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const past = rows.filter((m) => !upcoming.includes(m));
  const list = tab === 'upcoming' ? upcoming : past;
  const [hero, ...rest] = list;

  return (
    <View style={{ flex: 1 }}>
      <Header title="Events" big>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { key: 'upcoming', label: 'Upcoming' },
            { key: 'past', label: 'Past' },
          ]}
        />
      </Header>
      <Body loading={loading && !data} error={error} onRefresh={reload}>
        {data && !list.length && <Empty icon="calendar-outline" text={tab === 'upcoming' ? 'No upcoming events.' : 'No past events.'} />}
        {hero && tab === 'upcoming' && (
          <Card onPress={() => router.push({ pathname: '/events/[id]', params: { id: hero.id } })} style={{ padding: 0, overflow: 'hidden', borderWidth: 0 }}>
            <LinearGradient colors={GRADS[0]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20, alignItems: 'center', gap: 6 }}>
              <T weight="semibold" style={{ color: '#fff', fontSize: 22, textAlign: 'center' }}>
                {hero.title}
              </T>
              <T style={{ color: '#E3DDF7', fontSize: 13, letterSpacing: 1 }}>
                {shortDate(hero.scheduledAt).toUpperCase()} · {timeOf(hero.scheduledAt)} · {hero.location.toUpperCase()}
              </T>
              {hero.openVotes > 0 && <Badge label="Voting open" tone="orange" style={{ alignSelf: 'center', marginTop: 4 }} />}
            </LinearGradient>
          </Card>
        )}
        {(tab === 'upcoming' ? rest : list).map((m, i) => (
          <Card key={m.id} onPress={() => router.push({ pathname: '/events/[id]', params: { id: m.id } })} style={{ flexDirection: 'row', gap: 12, backgroundColor: tab === 'past' ? '#FDF5E9' : '#fff' }}>
            <LinearGradient colors={GRADS[(i + 1) % GRADS.length]} style={{ width: 96, height: 96, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="people" size={36} color="rgba(255,255,255,0.8)" />
              {m.status === 'CANCELLED' && (
                <View style={{ position: 'absolute', bottom: 8, left: 0, right: 0, backgroundColor: '#E5E5E5', paddingVertical: 2, alignItems: 'center' }}>
                  <T style={{ fontSize: 11 }}>Cancelled</T>
                </View>
              )}
              {m.status === 'HELD' && (
                <View style={{ position: 'absolute', bottom: 8, left: 0, right: 0, backgroundColor: C.orange, paddingVertical: 2, alignItems: 'center' }}>
                  <T style={{ fontSize: 11, color: '#fff' }}>Completed</T>
                </View>
              )}
            </LinearGradient>
            <View style={{ flex: 1, gap: 6 }}>
              <T style={{ fontSize: 16 }} numberOfLines={2}>
                {m.title}
              </T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="calendar-outline" size={15} color={C.orangeDeep} />
                <T style={{ color: C.sub, fontSize: 13 }}>{shortDate(m.scheduledAt)}</T>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="location-outline" size={15} color={C.orangeDeep} />
                <T style={{ color: C.sub, fontSize: 13 }} numberOfLines={1}>
                  {m.location}
                </T>
              </View>
            </View>
          </Card>
        ))}
        <T style={{ color: C.faint, fontSize: 12, textAlign: 'center' }}>Festivals and community events with photos are coming soon.</T>
      </Body>
    </View>
  );
}
