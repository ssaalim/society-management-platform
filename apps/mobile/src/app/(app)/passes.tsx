import React, { useState } from 'react';
import { Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Badge, Body, Button, Card, Chips, Empty, ErrorBox, Field, Header, Input, T } from '@/components/ui';
import { notify } from '@/components/visitors';
import { api, errMsg } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { C, shortDate, timeOf } from '@/lib/theme';

interface Pass {
  id: string;
  guestName: string;
  guestMobile: string | null;
  type: string;
  code: string;
  validFrom: string;
  validUntil: string;
  maxUses: number;
  usesCount: number;
  state: 'ACTIVE' | 'UPCOMING' | 'USED' | 'EXPIRED' | 'CANCELLED';
}

const WHEN = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'week', label: 'Next 7 days' },
] as const;
const TYPES = [
  { key: 'GUEST', label: 'Guest' },
  { key: 'DELIVERY', label: 'Delivery' },
  { key: 'CAB', label: 'Cab' },
  { key: 'SERVICE', label: 'Service' },
] as const;

function windowFor(k: (typeof WHEN)[number]['key']) {
  const start = new Date();
  const end = new Date();
  if (k === 'tomorrow') {
    start.setDate(start.getDate() + 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + 1);
  } else if (k === 'week') end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 0, 0);
  return { validFrom: start.toISOString(), validUntil: end.toISOString() };
}

/** Pre-approve a guest: they show the code or QR at the gate and walk in. */
export default function Passes() {
  const { data, error, loading, reload } = useApi<Pass[]>('/visitors/passes/list');
  const [making, setMaking] = useState(false);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [type, setType] = useState<(typeof TYPES)[number]['key']>('GUEST');
  const [when, setWhen] = useState<(typeof WHEN)[number]['key']>('today');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      const p = await api<Pass>('/visitors/passes', {
        method: 'POST',
        body: { guestName: name.trim(), guestMobile: mobile.trim() || null, type, ...windowFor(when), maxUses: when === 'week' ? 7 : 1 },
      });
      setMaking(false);
      setName('');
      setMobile('');
      setOpen(p?.id || null);
      reload();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (p: Pass) => {
    try {
      await api(`/visitors/passes/${p.id}/revoke`, { method: 'POST' });
      reload();
    } catch (e) {
      notify('Could not cancel', errMsg(e));
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="Guest passes" />
      <Body loading={loading && !data} error={error} onRefresh={reload}>
        {!making ? (
          <Button label="+ New guest pass" onPress={() => setMaking(true)} />
        ) : (
          <Card style={{ gap: 14 }}>
            <T weight="medium" style={{ fontSize: 16 }}>
              New guest pass
            </T>
            {err && <ErrorBox text={err} />}
            <Field label="Guest name">
              <Input value={name} onChangeText={setName} placeholder="e.g. Rohan Mehta" />
            </Field>
            <Field label="Mobile (optional)">
              <Input value={mobile} onChangeText={setMobile} placeholder="10-digit mobile" keyboardType="phone-pad" />
            </Field>
            <Field label="Who">
              <Chips value={type} onChange={setType} options={TYPES as any} />
            </Field>
            <Field label="When">
              <Chips value={when} onChange={setWhen} options={WHEN as any} />
            </Field>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setMaking(false)} />
              <Button label="Create" style={{ flex: 1 }} busy={busy} disabled={!name.trim()} onPress={create} />
            </View>
          </Card>
        )}
        {data && !data.length && <Empty icon="qr-code-outline" text="No passes. Create one so your guest can walk in without waiting." />}
        {(data || []).map((p) => {
          const live = p.state === 'ACTIVE' || p.state === 'UPCOMING';
          return (
            <Card key={p.id} onPress={() => setOpen(open === p.id ? null : p.id)} style={{ gap: 8, opacity: live ? 1 : 0.6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <T weight="medium" style={{ fontSize: 16 }}>
                  {p.guestName}
                </T>
                <Badge label={p.state === 'ACTIVE' ? 'Valid now' : p.state.toLowerCase()} tone={live ? 'green' : 'grey'} />
              </View>
              <T style={{ color: C.sub, fontSize: 13 }}>
                {shortDate(p.validFrom)} {timeOf(p.validFrom)} – {shortDate(p.validUntil)} {timeOf(p.validUntil)} · used {p.usesCount}/{p.maxUses}
              </T>
              {open === p.id && live && (
                <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                  <QRCode value={p.code} size={180} />
                  <T weight="semibold" style={{ fontSize: 28, letterSpacing: 6 }}>
                    {p.code}
                  </T>
                  <T style={{ color: C.sub, fontSize: 12, textAlign: 'center' }}>Your guest shows this code or QR at the gate.</T>
                  <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
                    <Button
                      label="Share"
                      icon="share-social-outline"
                      small
                      style={{ flex: 1 }}
                      onPress={() =>
                        Share.share({ message: `Your entry code is ${p.code}. Show it at the gate (valid till ${shortDate(p.validUntil)} ${timeOf(p.validUntil)}).` }).catch(() => {})
                      }
                    />
                    <Button label="Cancel pass" small variant="outline" style={{ flex: 1 }} onPress={() => revoke(p)} />
                  </View>
                </View>
              )}
            </Card>
          );
        })}
      </Body>
    </View>
  );
}
