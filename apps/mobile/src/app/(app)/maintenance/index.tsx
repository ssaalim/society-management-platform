import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Body, Button, Card, Empty, Header, IconBubble, T } from '@/components/ui';
import { BillCard, BillRow } from '@/components/bills';
import { useApi } from '@/lib/use-api';
import { C, monthOf, rupees } from '@/lib/theme';

export default function Maintenance() {
  const { data, error, loading, reload } = useApi<BillRow[]>('/maintenance?mine=true');
  const bills = (data || []).slice().sort((a, b) => b.periodStart.localeCompare(a.periodStart));
  const open = bills.filter((b) => b.status !== 'PAID');
  const latest = bills[0];
  const thisMonth = latest && latest.status !== 'PAID' ? Number(latest.remainingBalance) : 0;
  const total = open.reduce((n, b) => n + Number(b.remainingBalance), 0);
  const oldest = open.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const paid = bills.filter((b) => Number(b.totalPaid) > 0).slice(0, 10);

  return (
    <View style={{ flex: 1 }}>
      <Header title="Maintenance" />
      <Body loading={loading && !data} error={error} onRefresh={reload}>
        {data && (
          <Card style={{ backgroundColor: '#FFF9F0', borderColor: C.orangeLine, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconBubble name="construct" color="#E8768A" size={44} />
              <T weight="medium" style={{ fontSize: 16 }}>
                Maintenance Bill
              </T>
            </View>
            <Row k={latest ? `Latest bill · ${monthOf(latest.periodStart)}` : 'Latest bill'} v={rupees(thisMonth)} />
            <Row k="Outstanding dues" v={rupees(total - thisMonth)} />
            <Row k="Total dues" v={rupees(total)} strong />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              <Button
                label="Pay Now"
                icon="arrow-up-outline"
                style={{ flex: 1 }}
                disabled={!oldest}
                onPress={() => oldest && router.push({ pathname: '/maintenance/[id]', params: { id: oldest.id } })}
              />
              <Button label="History" icon="time-outline" variant="outline" style={{ flex: 1 }} onPress={() => router.push('/maintenance/history')} />
            </View>
          </Card>
        )}
        {open.length > 1 && (
          <>
            <T weight="medium" style={{ fontSize: 16, marginTop: 4 }}>
              Unpaid bills
            </T>
            {open.map((b) => (
              <BillCard key={b.id} b={b} />
            ))}
          </>
        )}
        <T weight="medium" style={{ fontSize: 16, marginTop: 4 }}>
          {paid.length ? `Last ${paid.length} Payments` : 'Payments'}
        </T>
        {data && !paid.length && <Empty icon="receipt-outline" text="No payments yet." />}
        {paid.map((b) => (
          <Card key={b.id} onPress={() => router.push({ pathname: '/maintenance/[id]', params: { id: b.id } })} style={{ backgroundColor: C.card, gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T style={{ fontSize: 16 }}>Maintenance Bill</T>
              <T style={{ fontSize: 16 }}>{rupees(b.totalPaid)}</T>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T style={{ color: C.orangeDeep, fontSize: 13 }}>For {monthOf(b.periodStart)}</T>
              <T style={{ color: C.sub, fontSize: 13 }}>{b.status === 'PAID' ? 'Paid in full' : `${rupees(b.remainingBalance)} left`}</T>
            </View>
          </Card>
        ))}
      </Body>
    </View>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <T weight={strong ? 'semibold' : 'regular'} style={{ color: strong ? C.orange : C.text }}>
        {k}
      </T>
      <T weight={strong ? 'semibold' : 'regular'} style={{ color: strong ? C.orange : C.text, fontSize: strong ? 17 : 15 }}>
        {v}
      </T>
    </View>
  );
}
