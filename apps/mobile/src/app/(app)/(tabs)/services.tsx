import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, Href } from 'expo-router';
import { Body, Header, IconBubble, IconName, T } from '@/components/ui';
import { C } from '@/lib/theme';

const SERVICES: { label: string; hint: string; icon: IconName; color: string; href?: Href }[] = [
  { label: 'Pay maintenance', hint: 'Bills and receipts', icon: 'wallet', color: '#E8768A', href: '/maintenance' },
  { label: 'Raise a complaint', hint: 'Water, lift, parking…', icon: 'chatbox-ellipses', color: '#E5484D', href: '/complaints/new' },
  { label: 'Fund collection', hint: 'Generator, painting…', icon: 'cash', color: '#3BA55C', href: '/funds' },
  { label: 'Guest pass', hint: 'Pre-approve a visitor', icon: 'qr-code', color: '#5B7CFA', href: '/passes' },
  { label: 'Meetings & votes', hint: 'AGM, notices, voting', icon: 'people-circle', color: '#9B6BE8', href: '/events' },
  { label: 'Committee', hint: 'Who does what', icon: 'ribbon', color: '#4FA77A', href: '/committee' },
  { label: 'Vehicles', hint: 'Coming soon', icon: 'car', color: C.faint },
  { label: 'Documents', hint: 'Coming soon', icon: 'document-text', color: C.faint },
];

export default function Services() {
  return (
    <View style={{ flex: 1 }}>
      <Header title="Services" back={false} />
      <Body>
        <View style={st.grid}>
          {SERVICES.map((s) => (
            <Pressable
              key={s.label}
              disabled={!s.href}
              onPress={() => s.href && router.push(s.href)}
              style={({ pressed }) => [st.tile, !s.href && { opacity: 0.55 }, pressed && { opacity: 0.8 }]}
              accessibilityLabel={`${s.label}. ${s.hint}`}
            >
              <IconBubble name={s.icon} color={s.color} bg={C.card} size={52} />
              <T weight="medium" style={{ fontSize: 15, textAlign: 'center' }}>
                {s.label}
              </T>
              <T style={{ fontSize: 12, color: C.sub, textAlign: 'center' }}>{s.hint}</T>
            </Pressable>
          ))}
        </View>
      </Body>
    </View>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { width: '47%', flexGrow: 1, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14, alignItems: 'center', gap: 6, backgroundColor: '#fff' },
});
