import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Body, Card, Chips, ErrorBox, Header, Ionicons, T } from '@/components/ui';
import { api, errMsg } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { C, shortDate, timeOf } from '@/lib/theme';

interface Detail {
  id: string;
  title: string;
  typeLabel: string;
  scheduledAt: string;
  location: string;
  description: string | null;
  status: string;
  myRsvp: string | null;
  canRsvp?: boolean;
  invited?: boolean;
  agenda: { id: string; title: string; description: string | null; presenter: string | null }[];
}

const RSVP = [
  { key: 'ATTENDING', label: 'Attending' },
  { key: 'TENTATIVE', label: 'Maybe' },
  { key: 'NOT_ATTENDING', label: 'Not attending' },
] as const;

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: m, error, loading, reload, setData } = useApi<Detail>(`/meetings/${id}`);
  const [err, setErr] = useState<string | null>(null);
  const upcoming = m && m.status === 'SCHEDULED' && new Date(m.scheduledAt).getTime() > Date.now();

  const rsvp = async (response: string) => {
    setErr(null);
    try {
      await api(`/meetings/${id}/rsvp`, { method: 'PUT', body: { response } });
      if (m) setData({ ...m, myRsvp: response });
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title={upcoming ? 'Upcoming Event' : 'Event'} />
      <Body loading={loading && !m} error={error} onRefresh={reload} style={{ padding: 0 }}>
        {m && (
          <>
            <LinearGradient colors={['#2B2350', '#5B3B8C']} style={{ height: 180, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="people" size={64} color="rgba(255,255,255,0.5)" />
            </LinearGradient>
            <View style={{ backgroundColor: '#fff', marginTop: -24, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, gap: 12 }}>
              <T style={{ color: C.orangeDeep }}>{m.typeLabel}</T>
              <T weight="medium" style={{ fontSize: 21 }}>
                {m.title}
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                <Meta icon="calendar-outline" text={`${shortDate(m.scheduledAt)} · ${timeOf(m.scheduledAt)}`} />
                <Meta icon="location-outline" text={m.location} />
              </View>
              {m.status === 'CANCELLED' && <ErrorBox text="This meeting was cancelled." />}
              {m.description ? (
                <>
                  <T weight="medium" style={{ fontSize: 16 }}>
                    About
                  </T>
                  <T style={{ color: C.sub, lineHeight: 22 }}>{m.description}</T>
                </>
              ) : null}
              {m.agenda?.length > 0 && (
                <>
                  <T weight="medium" style={{ fontSize: 16 }}>
                    Agenda
                  </T>
                  {m.agenda.map((a, i) => (
                    <Card key={a.id} style={{ backgroundColor: '#FFFBF5', gap: 2 }}>
                      <T weight="medium">
                        {i + 1}. {a.title}
                      </T>
                      {a.presenter && <T style={{ color: C.sub, fontSize: 13 }}>By {a.presenter}</T>}
                      {a.description && <T style={{ color: C.sub, fontSize: 13 }}>{a.description}</T>}
                    </Card>
                  ))}
                </>
              )}
              {upcoming && m.invited !== false && (
                <>
                  <T weight="medium" style={{ fontSize: 16 }}>
                    Will you attend?
                  </T>
                  <Chips value={(m.myRsvp || '') as any} onChange={rsvp} options={RSVP as any} />
                  {err && <ErrorBox text={err} />}
                </>
              )}
              <T style={{ color: C.faint, fontSize: 12 }}>Proxies, voting and minutes are on the society website for now.</T>
            </View>
          </>
        )}
      </Body>
    </View>
  );
}

function Meta({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ backgroundColor: '#FBEDE6', borderRadius: 12, padding: 4 }}>
        <Ionicons name={icon} size={15} color={C.orangeDeep} />
      </View>
      <T style={{ color: C.sub }}>{text}</T>
    </View>
  );
}
