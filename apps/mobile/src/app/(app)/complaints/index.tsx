import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Empty, Header, Ionicons, SearchBox, Segmented, T } from '@/components/ui';
import { CATEGORIES, Complaint, ComplaintCard, isActive } from '@/components/complaints';
import { useApi } from '@/lib/use-api';
import { C } from '@/lib/theme';

export default function Complaints() {
  const insets = useSafeAreaInsets();
  const { data, error, loading, reload } = useApi<Complaint[]>('/complaints');
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const list = (data || [])
    .filter((c) => (tab === 'active' ? isActive(c) : !isActive(c)))
    .filter((c) => !q.trim() || `${c.title} ${c.description}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <View style={{ flex: 1 }}>
      <Header title="Complaints">
        <SearchBox placeholder="Search for Complaint" value={q} onChangeText={setQ} />
      </Header>
      <Body loading={loading && !data} error={error} onRefresh={reload} style={{ paddingBottom: 100 + insets.bottom }}>
        <T weight="medium" style={{ fontSize: 16 }}>
          Category
        </T>
        <View style={st.grid}>
          {CATEGORIES.map((c) => (
            <Pressable key={c.key} style={({ pressed }) => [st.cat, pressed && { opacity: 0.8 }]} onPress={() => router.push({ pathname: '/complaints/new', params: { category: c.key } })}>
              <Ionicons name={c.icon} size={34} color={C.orangeDeep} />
              <T style={{ fontSize: 13 }}>{c.label}</T>
            </Pressable>
          ))}
        </View>
        <View style={{ marginTop: 6 }}>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { key: 'active', label: 'Active' },
              { key: 'history', label: 'History' },
            ]}
          />
        </View>
        {data && !list.length && <Empty icon="checkmark-done-outline" text={tab === 'active' ? 'No open complaints.' : 'No past complaints.'} />}
        {list.map((c) => (
          <ComplaintCard key={c.id} c={c} />
        ))}
      </Body>
      <View style={[st.fab, { paddingBottom: insets.bottom + 12 }]}>
        <Button label="+ Create New Complaint" onPress={() => router.push('/complaints/new')} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cat: {
    width: '31%',
    flexGrow: 1,
    height: 92,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F3D3C4',
    backgroundColor: '#FDF4F0',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  fab: { position: 'absolute', left: 16, right: 16, bottom: 0 },
});
