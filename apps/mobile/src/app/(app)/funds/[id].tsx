import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Badge, Body, Button, Card, Chips, ErrorBox, Field, Header, Input, KV, T } from '@/components/ui';
import { api, errMsg } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { C, rupees, shortDate, todayISO } from '@/lib/theme';

interface Share {
  id: string;
  flatId: string;
  flatLabel: string;
  invoiceNumber: string;
  amount: string;
  paidAmount: string;
  due: number;
  status: string;
  pendingClaimed: number;
  mine: boolean;
}
interface Fund {
  id: string;
  name: string;
  description: string | null;
  method: string;
  dueDate: string | null;
  status: string;
  collected: number;
  spent: number;
  balance: number;
  targetAmount: string;
  shares: Share[];
  payments: { id: string; amount: string; paidAt: string; receiptNumber: string; paymentMode: string; reversedAt: string | null }[];
  expenses: { id: string; description: string; amount: string; spentAt: string }[];
  claims: { id: string; amount: string; status: string; reference: string | null; rejectReason: string | null; paidAt: string }[];
}

const MODES = [
  { key: 'UPI', label: 'UPI' },
  { key: 'NEFT', label: 'Bank transfer' },
  { key: 'CHEQUE', label: 'Cheque' },
  { key: 'CASH', label: 'Cash' },
] as const;

export default function FundDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: f, error, loading, reload, setData } = useApi<Fund>(`/funds/${id}`);
  const [claiming, setClaiming] = useState<Share | 'voluntary' | null>(null);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<(typeof MODES)[number]['key']>('UPI');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mine = (f?.shares || []).filter((s) => s.mine);
  const send = async () => {
    if (!f || !claiming) return;
    setBusy(true);
    setErr(null);
    try {
      const share = claiming === 'voluntary' ? null : claiming;
      const next = await api<Fund>(`/funds/${f.id}/claims`, {
        method: 'POST',
        body: { shareId: share?.id || null, flatId: share?.flatId || null, amount: Number(amount), paidAt: todayISO(), paymentMode: mode, reference: ref.trim() || null, note: null },
      });
      setData(next);
      setClaiming(null);
      setDone(true);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title={f?.name || 'Fund'} />
      <Body loading={loading && !f} error={error} onRefresh={reload}>
        {f && (
          <>
            {f.description && <T style={{ color: C.sub }}>{f.description}</T>}
            <Card>
              <KV k="Target" v={rupees(f.targetAmount)} />
              <KV k="Collected" v={rupees(f.collected)} />
              <KV k="Spent" v={rupees(f.spent)} />
              {f.dueDate && <KV k="Pay by" v={shortDate(f.dueDate)} />}
            </Card>
            {done && (
              <Card style={{ backgroundColor: C.greenSoft, borderColor: '#BFE3CA' }}>
                <T>Sent. The treasurer will confirm it after checking the bank statement; until then it shows as due.</T>
              </Card>
            )}
            {mine.map((s) => (
              <Card key={s.id} style={{ gap: 6, backgroundColor: '#FFFBF5', borderColor: C.orangeLine }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <T weight="medium">Your share · {s.flatLabel}</T>
                  <Badge label={s.status === 'PAID' ? 'Paid' : s.status === 'WAIVED' ? 'Waived' : s.status === 'PARTIAL' ? 'Part paid' : 'Due'} tone={s.status === 'PAID' ? 'green' : s.status === 'WAIVED' ? 'grey' : 'orange'} />
                </View>
                <KV k="Share" v={rupees(s.amount)} />
                <KV k="Paid" v={rupees(s.paidAmount)} />
                {s.due > 0 && s.status !== 'WAIVED' && <KV k="Due" v={rupees(s.due)} />}
                {s.pendingClaimed > 0 && <Badge label={`${rupees(s.pendingClaimed)} waiting for approval`} tone="purple" />}
                {f.status === 'ACTIVE' && ['UNPAID', 'PARTIAL'].includes(s.status) && s.due - s.pendingClaimed > 0 && claiming === null && (
                  <Button
                    label="I've paid"
                    small
                    onPress={() => {
                      setAmount(String(s.due - s.pendingClaimed));
                      setClaiming(s);
                    }}
                  />
                )}
              </Card>
            ))}
            {f.method === 'VOLUNTARY' && f.status === 'ACTIVE' && claiming === null && (
              <Button
                label="I've contributed"
                onPress={() => {
                  setAmount('');
                  setClaiming('voluntary');
                }}
              />
            )}
            {claiming && (
              <Card style={{ gap: 14 }}>
                <T weight="medium" style={{ fontSize: 16 }}>
                  Tell the treasurer you paid
                </T>
                {err && <ErrorBox text={err} />}
                <Field label="Amount (₹)">
                  <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
                </Field>
                <Field label="How did you pay?">
                  <Chips value={mode} onChange={setMode} options={MODES as any} />
                </Field>
                <Field label="Reference no. (optional)">
                  <Input value={ref} onChangeText={setRef} placeholder="UTR / UPI ref / cheque no." />
                </Field>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setClaiming(null)} />
                  <Button label="Send" style={{ flex: 1 }} busy={busy} disabled={!(Number(amount) > 0)} onPress={send} />
                </View>
              </Card>
            )}
            {f.claims.filter((c) => c.status === 'REJECTED').slice(0, 3).map((c) => (
              <ErrorBox key={c.id} text={`Your ${rupees(c.amount)} payment${c.reference ? ` (${c.reference})` : ''} was not confirmed: ${c.rejectReason}`} />
            ))}
            {f.payments.length > 0 && (
              <Card style={{ gap: 6 }}>
                <T weight="medium">Your payments</T>
                {f.payments.map((p) => (
                  <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', opacity: p.reversedAt ? 0.5 : 1 }}>
                    <T style={{ color: C.sub, fontSize: 13 }}>
                      {shortDate(p.paidAt)} · {p.receiptNumber}
                      {p.reversedAt ? ' · reversed' : ''}
                    </T>
                    <T>{rupees(p.amount)}</T>
                  </View>
                ))}
              </Card>
            )}
            {f.expenses.length > 0 && (
              <Card style={{ gap: 6 }}>
                <T weight="medium">Spent from the fund</T>
                {f.expenses.map((e) => (
                  <View key={e.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <T style={{ color: C.sub, fontSize: 13, flex: 1 }}>
                      {shortDate(e.spentAt)} · {e.description}
                    </T>
                    <T>{rupees(e.amount)}</T>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}
      </Body>
    </View>
  );
}
