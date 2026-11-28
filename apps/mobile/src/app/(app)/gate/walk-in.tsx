import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Body, Button, Chips, ErrorBox, Field, Header, Input, T } from '@/components/ui';
import { DirWing } from '@/components/directory';
import { api, errMsg } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { C } from '@/lib/theme';

const TYPES = [
  { key: 'GUEST', label: 'Guest' },
  { key: 'DELIVERY', label: 'Delivery' },
  { key: 'CAB', label: 'Cab' },
  { key: 'SERVICE', label: 'Service' },
] as const;

/** Log someone at the gate. The resident gets asked in the app, unless the guard already confirmed by phone. */
export default function WalkIn() {
  const dir = useApi<DirWing[]>('/directory');
  const [flatQ, setFlatQ] = useState('');
  const [flat, setFlat] = useState<{ id: string; label: string } | null>(null);
  const [d, setD] = useState({ name: '', mobile: '', type: 'GUEST' as (typeof TYPES)[number]['key'], company: '', vehicleNumber: '', purpose: '', headcount: '1' });
  const [phoned, setPhoned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const flats = useMemo(() => {
    const all = (dir.data || []).flatMap((w) => w.flats.map((f) => ({ id: f.id, label: `${w.name}-${f.number}`, names: f.residents.map((r) => r.name).join(', ') })));
    const t = flatQ.trim().toLowerCase();
    return t ? all.filter((f) => f.label.toLowerCase().includes(t) || f.names.toLowerCase().includes(t)).slice(0, 8) : [];
  }, [dir.data, flatQ]);

  const save = async () => {
    if (!flat) return;
    setBusy(true);
    setErr(null);
    try {
      await api('/visitors', {
        method: 'POST',
        body: {
          flatId: flat.id,
          name: d.name.trim(),
          mobile: d.mobile.trim(),
          type: d.type,
          company: d.company.trim() || null,
          vehicleNumber: d.vehicleNumber.trim() || null,
          purpose: d.purpose.trim() || null,
          headcount: Number(d.headcount) || 1,
          gateNo: null,
          confirmedByPhone: phoned,
        },
      });
      if (router.canGoBack()) router.back();
      else router.replace('/gate');
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="Log a walk-in" />
      <Body>
        {err && <ErrorBox text={err} />}
        <Field label="Going to flat">
          {flat ? (
            <Pressable onPress={() => setFlat(null)} style={{ flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: C.orange, borderRadius: 12, padding: 14 }}>
              <T weight="medium">Flat {flat.label}</T>
              <T style={{ color: C.orangeDeep }}>Change</T>
            </Pressable>
          ) : (
            <>
              <Input value={flatQ} onChangeText={setFlatQ} placeholder="Flat number or resident name" autoFocus />
              {flats.map((f) => (
                <Pressable key={f.id} onPress={() => setFlat(f)} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
                  <T>Flat {f.label}</T>
                  {f.names ? <T style={{ color: C.sub, fontSize: 12 }}>{f.names}</T> : null}
                </Pressable>
              ))}
            </>
          )}
        </Field>
        <Field label="Visitor name">
          <Input value={d.name} onChangeText={(name) => setD({ ...d, name })} placeholder="e.g. Rohan Mehta" />
        </Field>
        <Field label="Mobile">
          <Input value={d.mobile} onChangeText={(mobile) => setD({ ...d, mobile })} placeholder="10-digit mobile" keyboardType="phone-pad" />
        </Field>
        <Field label="Who">
          <Chips value={d.type} onChange={(type) => setD({ ...d, type })} options={TYPES as any} />
        </Field>
        {d.type !== 'GUEST' && (
          <Field label="Company (optional)">
            <Input value={d.company} onChangeText={(company) => setD({ ...d, company })} placeholder="e.g. Swiggy, Uber, Urban Company" />
          </Field>
        )}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 2 }}>
            <Field label="Vehicle (optional)">
              <Input value={d.vehicleNumber} onChangeText={(vehicleNumber) => setD({ ...d, vehicleNumber })} placeholder="MH 04 AB 1234" autoCapitalize="characters" />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="People">
              <Input value={d.headcount} onChangeText={(headcount) => setD({ ...d, headcount })} keyboardType="number-pad" />
            </Field>
          </View>
        </View>
        <Field label="Purpose (optional)">
          <Input value={d.purpose} onChangeText={(purpose) => setD({ ...d, purpose })} placeholder="e.g. Meeting, parcel" />
        </Field>
        <Pressable onPress={() => setPhoned(!phoned)} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }} accessibilityRole="checkbox" accessibilityState={{ checked: phoned }}>
          <View style={{ width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: phoned ? C.orange : '#C9CDD6', backgroundColor: phoned ? C.orange : '#fff' }} />
          <T style={{ flex: 1 }}>I phoned the resident and they said yes (let in now)</T>
        </Pressable>
        <Button label={phoned ? 'Save and let in' : 'Ask the resident'} busy={busy} disabled={!flat || !d.name.trim() || d.mobile.replace(/\D/g, '').length < 7} onPress={save} />
      </Body>
    </View>
  );
}
