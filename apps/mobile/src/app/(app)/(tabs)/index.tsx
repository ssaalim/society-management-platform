import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Body, Header, IconBubble, IconName, Ionicons, SearchBox, T } from '@/components/ui';
import { cleanName, useAuth } from '@/lib/auth';
import { useApi } from '@/lib/use-api';
import { C, TILE_BG, rupees, shortDate } from '@/lib/theme';

const TILES: { label: string; icon: IconName; color: string; href: Href; keywords: string }[] = [
  { label: 'My Society', icon: 'business', color: '#E6A23C', href: '/society', keywords: 'society wing flats residents directory' },
  { label: 'Committee', icon: 'people', color: '#4FA77A', href: '/committee', keywords: 'committee president secretary treasurer' },
  { label: 'My Visitors', icon: 'person-circle', color: '#5B7CFA', href: '/visitors', keywords: 'visitors guests approve' },
  { label: 'Events', icon: 'calendar', color: '#9B6BE8', href: '/events', keywords: 'events meetings agm notice' },
  { label: 'Complaints', icon: 'mail-unread', color: '#E5484D', href: '/complaints', keywords: 'complaints issue problem repair' },
  { label: 'Maintenance', icon: 'construct', color: '#E8768A', href: '/maintenance', keywords: 'maintenance bill pay dues' },
];

interface Bill {
  id: string;
  remainingBalance: string;
  status: string;
  dueDate: string;
}

export default function Home() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const flats = useApi<{ flats: { id: string; label: string }[] }>('/visitors/mine');
  const bills = useApi<Bill[]>('/maintenance?mine=true');
  const notes = useApi<{ list: { id: string; status: string }[] }>('/notifications/my-notifications');

  const flat = flats.data?.flats?.[0]?.label;
  const flatTitle = flat ? flat.replace(/^(.*)-([^-]+)$/, '$2, $1') : '';
  const due = (bills.data || []).filter((b) => b.status !== 'PAID').reduce((n, b) => n + Number(b.remainingBalance || 0), 0);
  const nextDue = (bills.data || []).filter((b) => b.status !== 'PAID').sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const unread = (notes.data?.list || []).filter((n) => n.status !== 'READ').length;
  const tiles = q.trim() ? TILES.filter((t) => `${t.label} ${t.keywords}`.toLowerCase().includes(q.trim().toLowerCase())) : TILES;

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Header back={false} big>
        <View style={st.topRow}>
          <Pressable onPress={() => router.push('/menu')} hitSlop={10} accessibilityLabel="Menu">
            <Ionicons name="menu" size={30} color={C.text} />
          </Pressable>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <T style={{ color: C.sub, fontSize: 17 }}>Hello {cleanName(user?.name).split(' ')[0] || 'there'}!</T>
            <T weight="medium" style={{ fontSize: 24 }} numberOfLines={1}>
              {flatTitle || ' '}
            </T>
          </View>
          <Pressable onPress={() => router.push('/notifications')} style={st.bell} accessibilityLabel={`Notifications${unread ? `, ${unread} unread` : ''}`}>
            <Ionicons name="notifications-outline" size={22} color={C.text} />
            {unread > 0 && <View style={st.dot} />}
          </Pressable>
        </View>
        <SearchBox placeholder="What are you looking for?" value={q} onChangeText={setQ} />
      </Header>
      <Body
        onRefresh={() => {
          bills.reload();
          notes.reload();
        }}
      >
        <Pressable onPress={() => router.push(due > 0 ? '/maintenance' : '/events')}>
          <LinearGradient colors={due > 0 ? ['#2B2350', '#4B2F6B'] : ['#2E3A59', '#3C5A8A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.banner}>
            <View style={{ flex: 1, gap: 4 }}>
              <T style={{ color: '#F6C77A', fontSize: 13 }}>{due > 0 ? 'Maintenance' : 'Welcome'}</T>
              <T weight="semibold" style={{ color: '#fff', fontSize: 20 }}>
                {due > 0 ? `${rupees(due)} due` : 'All dues are clear'}
              </T>
              <T style={{ color: '#D8D4F0', fontSize: 13 }}>
                {due > 0 ? `${nextDue ? `Due by ${shortDate(nextDue.dueDate)} · ` : ''}Tap to pay` : 'See what is happening in your society'}
              </T>
            </View>
            <Ionicons name={due > 0 ? 'wallet-outline' : 'sparkles-outline'} size={56} color="rgba(255,255,255,0.25)" />
          </LinearGradient>
        </Pressable>

        <View style={st.grid}>
          {tiles.map((t, i) => (
            <Pressable key={t.label} onPress={() => router.push(t.href)} style={({ pressed }) => [st.tile, { backgroundColor: TILE_BG[TILES.indexOf(t) % TILE_BG.length] }, pressed && { opacity: 0.8 }]}>
              <IconBubble name={t.icon} color={t.color} size={64} />
              <T style={{ fontSize: 16 }}>{t.label}</T>
            </Pressable>
          ))}
          {!tiles.length && <T style={{ color: C.sub, padding: 8 }}>Nothing matches “{q}”. Try the Services tab.</T>}
        </View>
      </Body>
    </View>
  );
}

const st = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bell: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 8, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: C.orange },
  banner: { borderRadius: 16, padding: 18, minHeight: 120, flexDirection: 'row', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  tile: { width: '47%', flexGrow: 1, height: 132, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 10 },
});
