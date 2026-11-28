import React from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Avatar, Body, Header, Ionicons, T } from '@/components/ui';
import { cleanName } from '@/lib/auth';
import { useApi } from '@/lib/use-api';
import { C } from '@/lib/theme';
import type { Term } from './index';

export default function CommitteeMember() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<Term | null>('/committee/current');
  const p = data?.positions.find((x) => x.id === id);
  const lines = (p?.responsibilities || '')
    .split(/\n+/)
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
  const wa = p?.mobile?.replace(/\D/g, '');

  return (
    <View style={{ flex: 1 }}>
      <Header title="Committee" big />
      <Body loading={loading && !data} error={error || (data && !p ? 'Not found.' : null)} onRefresh={reload}>
        {p && (
          <>
            <View style={{ alignItems: 'center', gap: 4, marginTop: -8 }}>
              <View style={{ borderWidth: 4, borderColor: '#fff', borderRadius: 60 }}>
                <Avatar name={cleanName(p.name)} size={112} />
              </View>
              <T style={{ fontSize: 22 }}>{cleanName(p.name)}</T>
              <T style={{ color: C.orange, fontSize: 15 }}>
                {p.designationLabel}
                {p.flatLabel ? <T style={{ color: C.sub }}> · Flat {p.flatLabel}</T> : null}
              </T>
              <View style={{ flexDirection: 'row', gap: 14, marginTop: 10 }}>
                {p.email && <Contact icon="mail" color="#EA4335" label="Email" onPress={() => Linking.openURL(`mailto:${p.email}`)} />}
                {wa && <Contact icon="logo-whatsapp" color="#25D366" label="WhatsApp" onPress={() => Linking.openURL(`https://wa.me/${wa}`)} />}
                {p.mobile && <Contact icon="call" color="#5B7CFA" label="Call" onPress={() => Linking.openURL(`tel:${p.mobile}`)} />}
              </View>
              {!p.email && !p.mobile && <T style={{ color: C.faint, fontSize: 12, marginTop: 6 }}>Contact details are private. Reach them through the society office.</T>}
            </View>
            <View style={{ height: 1, backgroundColor: C.line, marginVertical: 6 }} />
            {p.bio ? (
              <>
                <T weight="medium" style={{ fontSize: 16 }}>
                  Bio
                </T>
                <T style={{ color: C.sub, lineHeight: 22 }}>{p.bio}</T>
              </>
            ) : null}
            {lines.length > 0 && (
              <View style={st.box}>
                <T weight="medium" style={{ color: C.orangeDeep, fontSize: 16 }}>
                  Role and Responsibilities
                </T>
                {lines.map((l, i) => {
                  const [head, ...rest] = l.split(':');
                  return (
                    <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                      <Ionicons name="checkmark" size={18} color={C.orangeDeep} />
                      <T style={{ flex: 1, color: C.sub, lineHeight: 22 }}>
                        {rest.length ? (
                          <>
                            <T weight="medium">{head}:</T>
                            {rest.join(':')}
                          </>
                        ) : (
                          l
                        )}
                      </T>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </Body>
    </View>
  );
}

function Contact({ icon, color, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; color: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={({ pressed }) => [st.contact, pressed && { opacity: 0.8 }]}>
      <Ionicons name={icon} size={28} color={color} />
    </Pressable>
  );
}

const st = StyleSheet.create({
  contact: { width: 86, height: 52, borderWidth: 1, borderColor: C.line, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  box: { backgroundColor: '#F2F6FD', borderColor: '#DCE6F8', borderWidth: 1, borderRadius: 12, padding: 16, gap: 10 },
});
