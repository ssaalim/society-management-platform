import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, Body, Empty, Header, Ionicons, SearchBox, T } from '@/components/ui';
import { cleanName } from '@/lib/auth';
import { useApi } from '@/lib/use-api';
import { C } from '@/lib/theme';

export interface Position {
  id: string;
  name: string | null;
  designationLabel: string;
  bio: string | null;
  responsibilities: string | null;
  photoUrl: string | null;
  flatLabel: string | null;
  email: string | null;
  mobile: string | null;
}
export interface Term {
  id: string;
  name: string;
  positions: Position[];
}

export default function Committee() {
  const { data, error, loading, reload } = useApi<Term | null>('/committee/current');
  const [q, setQ] = useState('');
  const people = (data?.positions || []).filter((p) => !q.trim() || `${p.name} ${p.designationLabel}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <View style={{ flex: 1 }}>
      <Header title="Committee">
        <SearchBox placeholder="Search for committee" value={q} onChangeText={setQ} />
      </Header>
      <Body loading={loading && data === null && !error} error={error} onRefresh={reload}>
        {!loading && !data && <Empty icon="people-outline" text="The society has not published its managing committee in the app yet." />}
        {data && (
          <T weight="medium" style={{ fontSize: 17, textAlign: 'center' }}>
            Managing Committee <T weight="medium" style={{ fontSize: 17, color: C.orange }}>{data.name}</T>
          </T>
        )}
        <View style={st.grid}>
          {people.map((p) => (
            <Pressable key={p.id} onPress={() => router.push({ pathname: '/committee/[id]', params: { id: p.id } })} style={({ pressed }) => [st.card, pressed && { opacity: 0.85 }]}>
              <Avatar name={cleanName(p.name)} size={84} />
              <T style={{ fontSize: 15, textAlign: 'center' }} numberOfLines={1}>
                {cleanName(p.name)}
              </T>
              <T style={{ color: C.sub, fontSize: 13 }}>{p.designationLabel}</T>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {p.mobile && (
                  <Pressable onPress={() => Linking.openURL(`tel:${p.mobile}`)} style={st.mini} accessibilityLabel={`Call ${cleanName(p.name)}`}>
                    <Ionicons name="call-outline" size={16} color={C.orange} />
                  </Pressable>
                )}
                {p.email && (
                  <Pressable onPress={() => Linking.openURL(`mailto:${p.email}`)} style={st.mini} accessibilityLabel={`Email ${cleanName(p.name)}`}>
                    <Ionicons name="mail-outline" size={16} color={C.orange} />
                  </Pressable>
                )}
              </View>
            </Pressable>
          ))}
        </View>
      </Body>
    </View>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '47%', flexGrow: 1, borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: C.card, padding: 14, alignItems: 'center', gap: 4 },
  mini: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
});
