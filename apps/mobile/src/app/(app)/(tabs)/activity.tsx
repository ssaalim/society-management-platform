import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, Href } from 'expo-router';
import { Body, Card, Empty, Header, IconBubble, IconName, Segmented, T } from '@/components/ui';
import { useApi } from '@/lib/use-api';
import { C, rupees, shortDate, timeOf } from '@/lib/theme';

interface Item {
  key: string;
  at: string;
  icon: IconName;
  color: string;
  title: string;
  body: string;
  href?: Href;
}

/** One timeline of everything about me: bills and payments, complaints, visitors and notices. */
export default function Activity() {
  const [filter, setFilter] = useState<'all' | 'money' | 'requests'>('all');
  const notes = useApi<{ list: any[] }>('/notifications/my-notifications');
  const bills = useApi<any[]>('/maintenance?mine=true');
  const complaints = useApi<any[]>('/complaints');
  const visitors = useApi<{ visits: any[] }>('/visitors/mine');

  const items = useMemo(() => {
    const out: (Item & { kind: 'money' | 'requests' | 'notice' })[] = [];
    for (const b of bills.data || []) {
      out.push({
        key: `b${b.id}`,
        kind: 'money',
        at: `${b.periodStart}T00:00:00`,
        icon: 'receipt-outline',
        color: '#E8768A',
        title: `Maintenance bill ${b.billNumber}`,
        body: b.status === 'PAID' ? `${rupees(b.amount)} · paid` : `${rupees(b.remainingBalance)} due by ${shortDate(b.dueDate)}`,
        href: { pathname: '/maintenance/[id]', params: { id: b.id } },
      });
      if (b.lastPayment?.paymentDate && b.lastPayment.billNumber === b.billNumber && !['REJECTED', 'BOUNCED', 'CANCELLED'].includes(b.lastPayment.status))
        out.push({
          key: `p${b.id}`,
          kind: 'money',
          at: `${b.lastPayment.paymentDate}T12:00:00`,
          icon: b.lastPayment.status === 'REVIEW' ? 'hourglass-outline' : 'checkmark-circle-outline',
          color: b.lastPayment.status === 'REVIEW' ? C.purple : C.green,
          title: b.lastPayment.status === 'REVIEW' ? 'Payment reported · being checked' : 'Payment received',
          body: `${rupees(b.lastPayment.amountPaid ?? b.totalPaid)} towards ${b.billNumber}`,
        });
    }
    for (const c of complaints.data || []) {
      out.push({
        key: `c${c.id}`,
        kind: 'requests',
        at: c.updatedAt || c.createdAt,
        icon: 'chatbox-ellipses-outline',
        color: C.red,
        title: c.title,
        body: `Complaint · ${String(c.status).toLowerCase()}`,
        href: { pathname: '/complaints/[id]', params: { id: c.id } },
      });
    }
    for (const v of visitors.data?.visits || []) {
      out.push({
        key: `v${v.id}`,
        kind: 'requests',
        at: v.entryTime,
        icon: 'person-outline',
        color: '#5B7CFA',
        title: `${v.name} · ${v.typeLabel || 'Visitor'}`,
        body: `Visitor · ${String(v.status).toLowerCase()}`,
        href: { pathname: '/visitors/[id]', params: { id: v.id } },
      });
    }
    for (const n of notes.data?.list || []) {
      out.push({ key: `n${n.id}`, kind: 'notice', at: n.createdAt, icon: 'notifications-outline', color: C.orangeDeep, title: n.title, body: n.body });
    }
    return out
      .filter((i) => filter === 'all' || i.kind === filter)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 100);
  }, [bills.data, complaints.data, visitors.data, notes.data, filter]);

  const loading = notes.loading && !notes.data;
  return (
    <View style={{ flex: 1 }}>
      <Header title="Activity" back={false}>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { key: 'all', label: 'All' },
            { key: 'money', label: 'Payments' },
            { key: 'requests', label: 'Requests' },
          ]}
        />
      </Header>
      <Body
        loading={loading}
        error={notes.error}
        onRefresh={() => {
          notes.reload();
          bills.reload();
          complaints.reload();
          visitors.reload();
        }}
      >
        {!loading && !items.length && <Empty icon="time-outline" text="Nothing here yet." />}
        {items.map((i) => (
          <Card key={i.key} onPress={i.href ? () => router.push(i.href!) : undefined} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <IconBubble name={i.icon} color={i.color} bg={C.card} size={40} />
            <View style={{ flex: 1, gap: 2 }}>
              <T weight="medium" numberOfLines={2}>
                {i.title}
              </T>
              <T style={{ color: C.sub, fontSize: 13 }} numberOfLines={3}>
                {i.body}
              </T>
              <T style={{ color: C.faint, fontSize: 12 }}>
                {shortDate(i.at)}
                {i.key.startsWith('n') || i.key.startsWith('v') ? ` · ${timeOf(i.at)}` : ''}
              </T>
            </View>
          </Card>
        ))}
      </Body>
    </View>
  );
}
