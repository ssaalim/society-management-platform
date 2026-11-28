import React, { useCallback, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Avatar, Badge, Body, Button, Card, Empty, Header, Ionicons, SectionTitle, T } from '@/components/ui';
import { Visit, notify } from '@/components/visitors';
import { api, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { isGuardOnly } from '@/lib/roles';
import { useApi } from '@/lib/use-api';
import { C, timeOf } from '@/lib/theme';

interface GateView {
  waiting: Visit[];
  approved: Visit[];
  denied: Visit[];
  inside: Visit[];
}

/** Refresh while the guard has this screen open. 20 s keeps database calls low (one small query per refresh). */
const REFRESH_MS = 20_000;

/** The gate desk: who is waiting for a resident, who may come in, and who is inside. */
export default function GateDesk() {
  const { society } = useAuth();
  const { data, error, loading, reload } = useApi<GateView>('/visitors/gate');
  const [busy, setBusy] = useState<string | null>(null);
  const guard = isGuardOnly(society?.role);

  useFocusEffect(
    useCallback(() => {
      const t = setInterval(reload, REFRESH_MS);
      return () => clearInterval(t);
    }, [reload]),
  );

  const act = async (v: Visit, path: string, body?: unknown) => {
    setBusy(v.id);
    try {
      await api(`/visitors/${v.id}/${path}`, { method: 'POST', body });
      await reload();
    } catch (e) {
      notify('That did not work', errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header
        title="Gate desk"
        back={!guard}
        right={
          guard ? (
            <Pressable onPress={() => router.push('/menu')} hitSlop={10} accessibilityLabel="Menu">
              <Ionicons name="menu" size={26} color={C.text} />
            </Pressable>
          ) : undefined
        }
      />
      <Body loading={loading && !data} error={error} onRefresh={reload}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button label="Enter code" icon="keypad-outline" style={{ flex: 1 }} onPress={() => router.push('/gate/code')} />
          <Button label="Walk-in" icon="person-add-outline" variant="outline" style={{ flex: 1 }} onPress={() => router.push('/gate/walk-in')} />
        </View>

        <SectionTitle>Waiting for residents ({data?.waiting.length ?? 0})</SectionTitle>
        {data && !data.waiting.length && <T style={{ color: C.sub }}>No one is waiting.</T>}
        {data?.waiting.map((v) => (
          <Row key={v.id} v={v}>
            {v.noResponse ? <Badge label="No answer" tone="grey" /> : <Badge label="Asked resident" tone="purple" />}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Button label="Yes, let in" small style={{ flex: 1 }} busy={busy === v.id} onPress={() => act(v, 'guard-decision', { approve: true, note: null })} />
              <Button label="Turn away" small variant="outline" style={{ flex: 1 }} disabled={busy === v.id} onPress={() => act(v, 'guard-decision', { approve: false, note: null })} />
            </View>
          </Row>
        ))}

        <SectionTitle>Approved, not in yet ({data?.approved.length ?? 0})</SectionTitle>
        {data && !data.approved.length && <T style={{ color: C.sub }}>Nobody.</T>}
        {data?.approved.map((v) => (
          <Row key={v.id} v={v}>
            <Button label="Let in" small icon="enter-outline" busy={busy === v.id} onPress={() => act(v, 'let-in')} style={{ marginTop: 8 }} />
          </Row>
        ))}

        <SectionTitle>Inside now ({data?.inside.length ?? 0})</SectionTitle>
        {data && !data.inside.length && <Empty icon="walk-outline" text="No visitors inside." />}
        {data?.inside.map((v) => (
          <Row key={v.id} v={v} since={v.enteredAt || v.entryTime}>
            <Button label="Mark exit" small variant="outline" icon="exit-outline" busy={busy === v.id} onPress={() => act(v, 'exit')} style={{ marginTop: 8 }} />
          </Row>
        ))}
      </Body>
    </View>
  );
}

function Row({ v, children, since }: { v: Visit; children?: React.ReactNode; since?: string }) {
  return (
    <Card style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={v.name} size={44} />
        <View style={{ flex: 1 }}>
          <T weight="medium" style={{ fontSize: 16 }}>
            {v.name}
            {v.headcount && v.headcount > 1 ? ` +${v.headcount - 1}` : ''}
          </T>
          <T style={{ color: C.sub, fontSize: 13 }}>
            {v.typeLabel}
            {v.company ? ` · ${v.company}` : ''} · Flat {v.flatLabel}
          </T>
          {v.vehicleNumber && <T style={{ color: C.sub, fontSize: 12 }}>Vehicle {v.vehicleNumber}</T>}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <T style={{ color: C.sub, fontSize: 12 }}>{since ? `in ${timeOf(since)}` : timeOf(v.entryTime)}</T>
          {v.mobile && (
            <Pressable onPress={() => Linking.openURL(`tel:${v.mobile}`)} hitSlop={8} accessibilityLabel={`Call ${v.name}`} style={{ backgroundColor: C.blueSoft, borderRadius: 16, padding: 6 }}>
              <Ionicons name="call" size={16} color="#5B7CFA" />
            </Pressable>
          )}
        </View>
      </View>
      {children}
    </Card>
  );
}
