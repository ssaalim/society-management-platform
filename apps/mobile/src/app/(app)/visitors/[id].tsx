import React, { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Body, Button, Header, Ionicons, T } from '@/components/ui';
import { Visit, decide, visitStatus } from '@/components/visitors';
import { useApi } from '@/lib/use-api';
import { C, shortDate, timeOf } from '@/lib/theme';

export default function VisitorDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<{ visits: Visit[] }>('/visitors/mine');
  const v = data?.visits.find((x) => x.id === id);
  const [busy, setBusy] = useState(false);
  const waiting = v?.status === 'PENDING' && !v.noResponse;

  const act = async (approve: boolean) => {
    if (!v) return;
    setBusy(true);
    if (await decide(v.id, approve)) await reload();
    setBusy(false);
  };

  const st = v ? visitStatus(v) : null;
  return (
    <View style={{ flex: 1 }}>
      <Header title="My Visitors" />
      <Body loading={loading && !data} error={error || (data && !v ? 'This visit is no longer in your list.' : null)} onRefresh={reload}>
        {v && st && (
          <>
            <View style={{ borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#C9BFF7' }}>
              <LinearGradient colors={['#ECE8FC', '#E8F0FB']} style={{ padding: 20, alignItems: 'center', gap: 12 }}>
                <View style={{ width: 140, height: 140, borderRadius: 70, backgroundColor: '#D9D2F8', borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person" size={80} color="#8F80E8" />
                </View>
                <T weight="medium" style={{ fontSize: 22 }}>
                  {v.name}
                </T>
                <View style={{ alignSelf: 'stretch', gap: 10 }}>
                  {v.mobile && <Row k="Ph. Number" v={v.mobile} />}
                  <Row k="Type" v={v.typeLabel + (v.company ? ` · ${v.company}` : '')} />
                  <Row k="Date" v={shortDate(v.entryTime)} />
                  <Row k="Check In Time" v={timeOf(v.enteredAt || v.entryTime)} />
                  {v.headcount && v.headcount > 1 ? <Row k="People" v={String(v.headcount)} /> : null}
                  {v.vehicleNumber && <Row k="Vehicle" v={v.vehicleNumber} />}
                  <Row k="Purpose" v={v.purpose || '—'} />
                  <Row k="For flat" v={v.flatLabel} />
                </View>
                {v.mobile && (
                  <Pressable onPress={() => Linking.openURL(`tel:${v.mobile}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 24, paddingHorizontal: 18, paddingVertical: 8 }}>
                    <Ionicons name="call" size={18} color="#5B7CFA" />
                    <T>Call</T>
                  </Pressable>
                )}
              </LinearGradient>
              {waiting && (
                <View style={{ backgroundColor: C.purple, padding: 10, alignItems: 'center' }}>
                  <T style={{ color: '#fff' }}>Waiting for Approval</T>
                </View>
              )}
            </View>
            {!waiting && (
              <View style={{ alignItems: 'center', gap: 6, marginTop: 8 }}>
                <Ionicons
                  name={st.tone === 'red' ? 'close-circle' : st.tone === 'grey' ? 'time' : 'checkmark-circle'}
                  size={64}
                  color={st.tone === 'red' ? C.red : st.tone === 'grey' ? C.faint : '#F4C430'}
                />
                <T style={{ fontSize: 20, color: C.sub }}>{st.label}</T>
                {v.decidedByName && <T style={{ color: C.faint, fontSize: 12 }}>by {v.decidedByName.replace(/\s*\(.*\)$/, '')}</T>}
              </View>
            )}
            {waiting && (
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                <Button label="Decline" variant="outline" style={{ flex: 1 }} disabled={busy} onPress={() => act(false)} />
                <Button label="Approve" style={{ flex: 1 }} busy={busy} onPress={() => act(true)} />
              </View>
            )}
          </>
        )}
      </Body>
    </View>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <T style={{ color: C.sub, width: 120, textAlign: 'right' }}>{k} :</T>
      <T weight="medium" style={{ flex: 1 }}>
        {v}
      </T>
    </View>
  );
}
