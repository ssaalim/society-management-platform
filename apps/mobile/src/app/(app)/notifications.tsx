import React from 'react';
import { View } from 'react-native';
import { Body, Card, Empty, Header, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { C, shortDate, timeOf } from '@/lib/theme';

interface Note {
  id: string;
  title: string;
  body: string;
  status: string;
  createdAt: string;
}

export default function Notifications() {
  const { data, error, loading, reload, setData } = useApi<{ list: Note[] }>('/notifications/my-notifications');
  const list = data?.list || [];
  const unread = list.some((n) => n.status !== 'READ');

  const markAll = async () => {
    await api('/notifications/mark-all-read', { method: 'PATCH' }).catch(() => {});
    setData({ list: list.map((n) => ({ ...n, status: 'READ' })) });
  };
  const open = (n: Note) => {
    if (n.status === 'READ') return;
    api(`/notifications/${n.id}/read`, { method: 'PATCH' }).catch(() => {});
    setData({ list: list.map((x) => (x.id === n.id ? { ...x, status: 'READ' } : x)) });
  };

  return (
    <View style={{ flex: 1 }}>
      <Header
        title="Notifications"
        right={
          unread ? (
            <T style={{ color: C.orangeDeep }} onPress={markAll}>
              Mark all read
            </T>
          ) : undefined
        }
      />
      <Body loading={loading && !data} error={error} onRefresh={reload}>
        {data && !list.length && <Empty icon="notifications-off-outline" text="You are all caught up." />}
        {list.map((n) => (
          <Card key={n.id} onPress={() => open(n)} style={{ gap: 4, backgroundColor: n.status === 'READ' ? '#fff' : '#FFF8EE', borderColor: n.status === 'READ' ? C.line : C.orangeLine }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              {n.status !== 'READ' && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.orange }} />}
              <T weight="medium" style={{ flex: 1 }}>
                {n.title}
              </T>
            </View>
            <T style={{ color: C.sub, fontSize: 13 }}>{n.body}</T>
            <T style={{ color: C.faint, fontSize: 12 }}>
              {shortDate(n.createdAt)} · {timeOf(n.createdAt)}
            </T>
          </Card>
        ))}
      </Body>
    </View>
  );
}
