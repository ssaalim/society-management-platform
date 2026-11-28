import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Body, Card, Empty, Header, T } from '@/components/ui';
import { useApi } from '@/lib/use-api';
import { C, rupees, shortDate } from '@/lib/theme';

interface FundRow {
  id: string;
  name: string;
  description: string | null;
  methodLabel: string;
  dueDate: string | null;
  status: string;
  collected: number;
  targetAmount: string;
  percent: number;
  myDue?: number;
  myShares?: number;
}

export default function Funds() {
  const { data, error, loading, reload } = useApi<FundRow[]>('/funds');
  return (
    <View style={{ flex: 1 }}>
      <Header title="Fund collection" />
      <Body loading={loading && !data} error={error} onRefresh={reload}>
        {data && !data.length && <Empty icon="cash-outline" text="No fund collections right now." />}
        {(data || []).map((f) => (
          <Card key={f.id} onPress={() => router.push({ pathname: '/funds/[id]', params: { id: f.id } })} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <T weight="medium" style={{ fontSize: 16, flex: 1 }}>
                {f.name}
              </T>
              {f.status === 'CLOSED' ? <Badge label="Closed" tone="grey" /> : <Badge label="Collecting" tone="green" />}
            </View>
            <T style={{ color: C.sub, fontSize: 13 }}>
              {f.methodLabel}
              {f.dueDate ? ` · pay by ${shortDate(f.dueDate)}` : ''}
            </T>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: '#F1EEE8', overflow: 'hidden' }}>
              <View style={{ width: `${Math.min(100, f.percent || 0)}%`, height: '100%', backgroundColor: C.orange }} />
            </View>
            <T style={{ fontSize: 13 }}>
              {rupees(f.collected)} of {rupees(f.targetAmount)}
            </T>
            {!!f.myShares && (
              <Badge label={(f.myDue ?? 0) > 0 ? `You owe ${rupees(f.myDue)}` : 'Your share is settled'} tone={(f.myDue ?? 0) > 0 ? 'orange' : 'green'} />
            )}
          </Card>
        ))}
      </Body>
    </View>
  );
}
