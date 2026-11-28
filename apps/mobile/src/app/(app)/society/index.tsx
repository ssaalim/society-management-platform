import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Body, Empty, Header, Ionicons, SearchBox, T } from '@/components/ui';
import { DirWing, FlatCard } from '@/components/directory';
import { useApi } from '@/lib/use-api';
import { C } from '@/lib/theme';

/** My Society: the wings; search finds a resident or flat anywhere in the society. */
export default function MySociety() {
  const { data, error, loading, reload } = useApi<DirWing[]>('/directory');
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const hits = term
    ? (data || []).flatMap((w) =>
        w.flats.filter((f) => f.number.toLowerCase().includes(term) || f.residents.some((r) => r.name.toLowerCase().includes(term))).map((f) => ({ f, w })),
      )
    : [];

  return (
    <View style={{ flex: 1 }}>
      <Header title="My Society">
        <SearchBox placeholder="Search for resident" value={q} onChangeText={setQ} />
      </Header>
      <Body loading={loading && !data} error={error} onRefresh={reload}>
        {term ? (
          <>
            {!hits.length && <Empty icon="search-outline" text={`No resident or flat matches “${q}”.`} />}
            {hits.slice(0, 50).map(({ f, w }) => (
              <FlatCard key={f.id} f={f} wingName={w.name} />
            ))}
          </>
        ) : (
          <>
            <T style={{ color: C.sub }}>View society residents details</T>
            {data && !data.length && <Empty icon="business-outline" text="No flats have been added yet." />}
            <View style={st.grid}>
              {(data || []).map((w) => (
                <Pressable key={w.id} onPress={() => router.push({ pathname: '/society/[wing]', params: { wing: w.id } })} style={({ pressed }) => [st.cell, pressed && { opacity: 0.8 }]}>
                  <View style={st.circle}>
                    <Ionicons name="business-outline" size={40} color={C.orangeDeep} />
                    <T weight="medium" style={{ fontSize: 17 }} numberOfLines={1}>
                      {w.name}
                    </T>
                    <T style={{ color: C.sub, fontSize: 13 }}>{w.flatCount} Flat{w.flatCount === 1 ? '' : 's'}</T>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </Body>
    </View>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', rowGap: 18 },
  cell: { width: '48%', alignItems: 'center' },
  circle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#FFF8EE',
    borderWidth: 1,
    borderColor: C.orangeLine,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 8,
  },
});
