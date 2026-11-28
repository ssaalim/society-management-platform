import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Card, T } from './ui';
import { C, monthOf, rupees, shortDate } from '@/lib/theme';

export interface BillRow {
  id: string;
  billNumber: string;
  periodStart: string;
  dueDate: string;
  amount: string;
  status: string;
  totalPaid: string;
  remainingBalance: string;
  flatNumber: string;
  lastPayment: { receiptNumber: string; amountPaid: string; paymentDate: string; billNumber: string; monthYear?: string } | null;
}

export const billTone = (s: string) => (s === 'PAID' ? 'green' : s === 'PARTIAL' || s === 'PARTIALLY_PAID' ? 'purple' : s === 'OVERDUE' ? 'red' : 'orange');
export const billLabel = (s: string) =>
  ({ PAID: 'Paid', UNPAID: 'Due', PARTIAL: 'Part paid', PARTIALLY_PAID: 'Part paid', OVERDUE: 'Overdue', PENDING_VERIFICATION: 'Being checked' } as Record<string, string>)[s] ||
  s.toLowerCase();

export function BillCard({ b }: { b: BillRow }) {
  return (
    <Card onPress={() => router.push({ pathname: '/maintenance/[id]', params: { id: b.id } })} style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T style={{ fontSize: 16 }}>{monthOf(b.periodStart)}</T>
        <Badge label={billLabel(b.status)} tone={billTone(b.status) as any} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T style={{ color: C.sub, fontSize: 13 }}>
          {b.billNumber} · due {shortDate(b.dueDate)}
        </T>
        <T weight="medium">{rupees(b.status === 'PAID' ? b.amount : b.remainingBalance)}</T>
      </View>
    </Card>
  );
}
