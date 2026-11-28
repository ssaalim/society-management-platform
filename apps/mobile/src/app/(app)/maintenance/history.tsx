import React from 'react';
import { View } from 'react-native';
import { Body, Empty, Header } from '@/components/ui';
import { useApi } from '@/lib/use-api';
import { BillCard, BillRow } from '@/components/bills';

export default function BillHistory() {
  const { data, error, loading, reload } = useApi<BillRow[]>('/maintenance?mine=true');
  const bills = (data || []).slice().sort((a, b) => b.periodStart.localeCompare(a.periodStart));
  return (
    <View style={{ flex: 1 }}>
      <Header title="All bills" />
      <Body loading={loading && !data} error={error} onRefresh={reload}>
        {data && !bills.length && <Empty icon="receipt-outline" text="No bills yet." />}
        {bills.map((b) => (
          <BillCard key={b.id} b={b} />
        ))}
      </Body>
    </View>
  );
}
