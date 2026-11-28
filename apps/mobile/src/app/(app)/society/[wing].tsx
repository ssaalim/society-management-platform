import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Body, Empty, Header, SearchBox, T } from '@/components/ui';
import { DirWing, FlatCard, ordinal } from '@/components/directory';
import { useApi } from '@/lib/use-api';
import { C } from '@/lib/theme';

/** One wing: floor chips, then each flat with who lives there. */
export default function Wing() {
  const { wing } = useLocalSearchParams<{ wing: string }>();
  const { data, error, loading, reload } = useApi<DirWing[]>('/directory');
  const w = data?.find((x) => x.id === wing);
  const floors = [...new Set((w?.flats || []).map((f) => f.floor ?? 0))].sort((a, b) => a - b);
  const [floor, setFloor] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const picked = floor ?? floors[0] ?? null;
  const flats = (w?.flats || []).filter((f) =>
    term ? f.number.toLowerCase().includes(term) || f.residents.some((r) => r.name.toLowerCase().includes(term)) : (f.floor ?? 0) === picked,
  );

  return (
    <View style={{ flex: 1 }}>
      <Header title={w?.name || 'Wing'}>
        <SearchBox placeholder="Search for resident" value={q} onChangeText={setQ} />
      </Header>
      <Body loading={loading && !data} error={error || (data && !w ? 'Wing not found.' : null)} onRefresh={reload}>
        {w && (
          <>
            <T style={{ color: C.sub }}>
              View Wing details · {w.occupied} of {w.flatCount} flats occupied
            </T>
            {!term && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {floors.map((n) => {
                  const on = n === picked;
                  return (
                    <Pressable
                      key={n}
                      onPress={() => setFloor(n)}
                      style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 4, borderWidth: 1, borderColor: on ? C.orange : '#D9DCE3', backgroundColor: on ? C.orange : '#fff' }}
                      accessibilityState={{ selected: on }}
                    >
                      <T style={{ color: on ? '#fff' : C.sub }}>{n === 0 ? 'Ground' : `${ordinal(n)} Floor`}</T>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            {!flats.length && <Empty icon="home-outline" text={term ? `No one matches “${q}”.` : 'No flats on this floor.'} />}
            {flats.map((f) => (
              <FlatCard key={f.id} f={f} />
            ))}
          </>
        )}
      </Body>
    </View>
  );
}
