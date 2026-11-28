import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Badge, Body, Button, Card, Chips, ErrorBox, Field, Header, Input, KV, T } from '@/components/ui';
import { api, errMsg } from '@/lib/api';
import { cleanName, useAuth } from '@/lib/auth';
import { useApi } from '@/lib/use-api';
import { C, monthOf, rupees, shortDate, todayISO } from '@/lib/theme';
import { billLabel, billTone } from '@/components/bills';

interface Bill {
  id: string;
  billNumber: string;
  periodStart: string;
  createdAt: string;
  dueDate: string;
  amount: string;
  status: string;
  totalPaid: string;
  remainingBalance: string;
  flatNumber: string;
  wingName: string | null;
  buildingName: string | null;
  billedToName?: string | null;
  ownerName?: string | null;
  overdueDays?: number;
  calculatedLateFee?: number;
  totalPayableWithLateFee?: string;
  recentReceipts: { id: string; receiptNumber: string; amountPaid: string; paymentDate: string; paymentMode: string; billNumber: string; status?: string }[];
}

const MODES = [
  { key: 'UPI', label: 'UPI' },
  { key: 'NEFT', label: 'Bank transfer' },
  { key: 'CHEQUE', label: 'Cheque' },
  { key: 'CASH', label: 'Cash' },
] as const;

/** The bill as a ticket (mockup), with "I've paid" to tell the office about a UPI/bank payment. */
export default function BillDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: b, error, loading, reload } = useApi<Bill>(`/maintenance/${id}`);
  const [paying, setPaying] = useState(false);
  const [mode, setMode] = useState<(typeof MODES)[number]['key']>('UPI');
  const [amount, setAmount] = useState('');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const due = b ? Number(b.totalPayableWithLateFee ?? b.remainingBalance) : 0;
  const mine = (b?.recentReceipts || []).filter((r) => r.billNumber === b?.billNumber);
  const inReview = mine.filter((r) => r.status === 'REVIEW').reduce((n, r) => n + Number(r.amountPaid), 0);
  const submit = async () => {
    if (!b) return;
    setBusy(true);
    setMsg(null);
    try {
      await api('/maintenance/receipt', {
        method: 'POST',
        body: { billId: b.id, amountPaid: Number(amount || due), paymentMode: mode, transactionId: ref.trim() || null, paymentDate: todayISO() },
      });
      setPaying(false);
      setMsg({ ok: true, text: 'Sent to the office. It will show as paid once they confirm it against the bank statement.' });
      reload();
    } catch (e) {
      setMsg({ ok: false, text: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="Maintenance Bill" />
      <Body loading={loading && !b} error={error} onRefresh={reload}>
        {b && (
          <>
            <View style={st.ticket}>
              <View style={{ padding: 18, alignItems: 'center', gap: 6 }}>
                <T weight="medium" style={{ fontSize: 19 }}>
                  Maintenance Due - {monthOf(b.periodStart)}
                </T>
                <Badge label={billLabel(b.status)} tone={billTone(b.status) as any} style={{ alignSelf: 'center' }} />
              </View>
              <View style={st.tear}>
                <View style={[st.notch, { left: -14 }]} />
                <View style={st.dash} />
                <View style={[st.notch, { right: -14 }]} />
              </View>
              <View style={{ paddingHorizontal: 22, paddingVertical: 10 }}>
                <KV k="Name" v={cleanName(b.billedToName || b.ownerName || user?.name)} />
                <KV k="Flat No." v={[b.flatNumber, b.wingName, b.buildingName].filter(Boolean).join(', ')} />
                <KV k="Bill No." v={b.billNumber} />
                <KV k="Bill Date" v={shortDate(b.createdAt)} />
                <KV k="Bill Due Date" v={shortDate(b.dueDate)} />
                <KV k="Maintenance Charge" v={rupees(b.amount)} />
                {Number(b.totalPaid) > 0 && <KV k="Paid" v={rupees(b.totalPaid)} />}
                {Number(b.calculatedLateFee || 0) > 0 && <KV k={`Late fee (${b.overdueDays} days)`} v={rupees(b.calculatedLateFee)} />}
                {b.status !== 'PAID' && <KV k="To pay" v={<T weight="semibold" style={{ color: C.orangeDeep, fontSize: 16 }}>{rupees(due)}</T>} />}
              </View>
            </View>

            {msg && (msg.ok ? <Card style={{ backgroundColor: C.greenSoft, borderColor: '#BFE3CA' }}><T>{msg.text}</T></Card> : <ErrorBox text={msg.text} />)}

            {mine.length > 0 && (
              <Card style={{ gap: 6 }}>
                <T weight="medium">Payments on this bill</T>
                {mine.map((r) => (
                  <View key={r.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, opacity: ['REJECTED', 'BOUNCED', 'CANCELLED'].includes(r.status || '') ? 0.5 : 1 }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <T style={{ color: C.sub, fontSize: 13 }}>
                        {shortDate(r.paymentDate)} · {r.paymentMode} · {r.receiptNumber}
                      </T>
                      {r.status && r.status !== 'CLEARED' && (
                        <Badge
                          label={r.status === 'REVIEW' ? 'Being checked by the office' : r.status === 'REJECTED' ? 'Not confirmed' : r.status.toLowerCase()}
                          tone={r.status === 'REVIEW' ? 'purple' : 'red'}
                        />
                      )}
                    </View>
                    <T>{rupees(r.amountPaid)}</T>
                  </View>
                ))}
              </Card>
            )}

            {inReview > 0 && b.status !== 'PAID' && (
              <Card style={{ backgroundColor: C.purpleSoft, borderColor: '#DCD5FB' }}>
                <T>{rupees(inReview)} you reported is waiting for the office to confirm.</T>
              </Card>
            )}
            {b.status !== 'PAID' && !paying && inReview < due && (
              <View style={{ gap: 8, marginTop: 8 }}>
                <Button
                  label="Pay Now"
                  onPress={() => {
                    setAmount(String(Math.max(0, due - inReview)));
                    setPaying(true);
                  }}
                />
                <T style={{ color: C.sub, fontSize: 12, textAlign: 'center' }}>
                  Pay by UPI or bank transfer to the society account, then tell us here. Online card/UPI checkout is coming soon.
                </T>
                <Button label="Remind Later" variant="ghost" onPress={() => router.back()} />
              </View>
            )}

            {paying && (
              <Card style={{ gap: 14 }}>
                <T weight="medium" style={{ fontSize: 16 }}>
                  I&apos;ve paid
                </T>
                <Field label="Amount paid (₹)">
                  <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
                </Field>
                <Field label="How did you pay?">
                  <Chips value={mode} onChange={setMode} options={MODES as any} />
                </Field>
                <Field label="Reference no. (optional)" hint="UTR, UPI reference or cheque number helps the office find it quickly.">
                  <Input value={ref} onChangeText={setRef} placeholder="e.g. 4321 8765 1234" autoCapitalize="characters" />
                </Field>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setPaying(false)} />
                  <Button label="Send" style={{ flex: 1 }} busy={busy} disabled={!(Number(amount) > 0)} onPress={submit} />
                </View>
              </Card>
            )}
          </>
        )}
      </Body>
    </View>
  );
}

const st = StyleSheet.create({
  ticket: { borderWidth: 1, borderColor: C.orangeLine, borderRadius: 14, backgroundColor: '#FFFBF5', overflow: 'visible' },
  tear: { height: 28, justifyContent: 'center' },
  dash: { marginHorizontal: 20, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: '#EDB7A0' },
  notch: { position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: C.orangeLine },
});
