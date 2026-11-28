import React from 'react';
import { Linking, View } from 'react-native';
import { router, Href } from 'expo-router';
import Constants from 'expo-constants';
import { Avatar, Body, Card, Header, IconBubble, IconName, T } from '@/components/ui';
import { cleanName, useAuth } from '@/lib/auth';
import { C } from '@/lib/theme';

/** The hamburger menu: who I am, my society (switch if several), and sign out. */
export default function Menu() {
  const { user, society, memberships, switchSociety, signOut } = useAuth();
  const items: { icon: IconName; label: string; href?: Href; onPress?: () => void; soon?: boolean }[] = [
    { icon: 'notifications-outline', label: 'Notifications', href: '/notifications' },
    { icon: 'business-outline', label: 'My society', href: '/society' },
    { icon: 'people-outline', label: 'Family members', soon: true },
    { icon: 'lock-closed-outline', label: 'Privacy (who sees my number)', soon: true },
    { icon: 'globe-outline', label: 'Open the society website', onPress: () => process.env.EXPO_PUBLIC_WEB_URL && Linking.openURL(process.env.EXPO_PUBLIC_WEB_URL) },
  ];
  return (
    <View style={{ flex: 1 }}>
      <Header title="Menu" />
      <Body>
        <Card style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Avatar name={cleanName(user?.name)} size={56} />
          <View style={{ flex: 1 }}>
            <T weight="medium" style={{ fontSize: 17 }}>
              {cleanName(user?.name)}
            </T>
            <T style={{ color: C.sub, fontSize: 13 }}>{user?.email}</T>
            {user?.mobile && <T style={{ color: C.sub, fontSize: 13 }}>{user.mobile}</T>}
          </View>
        </Card>
        {memberships.length > 1 && (
          <Card style={{ gap: 8 }}>
            <T weight="medium">Society</T>
            {memberships.map((m) => (
              <T
                key={m.societyId}
                onPress={() => switchSociety(m.societyId).then(() => router.replace('/'))}
                style={{ color: m.societyId === society?.societyId ? C.orangeDeep : C.text, paddingVertical: 4 }}
              >
                {m.societyId === society?.societyId ? '● ' : '○ '}
                {m.societyName}
              </T>
            ))}
          </Card>
        )}
        {memberships.length <= 1 && society && (
          <T style={{ color: C.sub, textAlign: 'center' }}>
            {society.societyName} · {society.role.replace(/_/g, ' ').toLowerCase()}
          </T>
        )}
        {items
          .filter((i) => i.href || i.soon || (i.onPress && process.env.EXPO_PUBLIC_WEB_URL))
          .map((i) => (
            <Card
              key={i.label}
              onPress={i.soon ? undefined : () => (i.href ? router.push(i.href) : i.onPress?.())}
              style={{ flexDirection: 'row', gap: 12, alignItems: 'center', opacity: i.soon ? 0.55 : 1 }}
            >
              <IconBubble name={i.icon} color={C.orangeDeep} bg={C.card} size={40} />
              <T style={{ flex: 1 }}>{i.label}</T>
              {i.soon && <T style={{ color: C.faint, fontSize: 12 }}>Soon</T>}
            </Card>
          ))}
        <Card onPress={() => signOut()} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', borderColor: '#F8C9CB' }}>
          <IconBubble name="log-out-outline" color={C.red} bg={C.redSoft} size={40} />
          <T style={{ color: C.red }}>Sign out</T>
        </Card>
        <T style={{ color: C.faint, fontSize: 12, textAlign: 'center' }}>Housive {Constants.expoConfig?.version}</T>
      </Body>
    </View>
  );
}
