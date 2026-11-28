import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Body, Button, Chips, ErrorBox, Field, Header, Input, T } from '@/components/ui';
import { CATEGORIES } from '@/components/complaints';
import { api, errMsg } from '@/lib/api';
import { C } from '@/lib/theme';

const PRIORITIES = [
  { key: 'LOW', label: 'Low' },
  { key: 'MEDIUM', label: 'Medium' },
  { key: 'HIGH', label: 'High' },
  { key: 'URGENT', label: 'Urgent' },
] as const;

export default function NewComplaint() {
  const params = useLocalSearchParams<{ category?: string }>();
  const [category, setCategory] = useState(params.category || 'Maintenance');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]['key']>('MEDIUM');
  const [flatOptions, setFlatOptions] = useState<{ key: string; label: string }[]>([]);
  const [flatId, setFlatId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ flats: { id: string; label?: string; number?: string; wingName?: string }[] }>('/complaints/flat-options')
      .then((d) => {
        const flats = (d?.flats || []).map((f) => ({ key: f.id, label: `My flat ${f.label || [f.wingName, f.number].filter(Boolean).join('-')}` }));
        setFlatOptions([...flats, { key: '', label: 'Common area' }]);
        if (flats.length) setFlatId(flats[0].key);
      })
      .catch(() => setFlatOptions([{ key: '', label: 'Common area' }]));
  }, []);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const c = await api<{ id: string }>('/complaints', {
        method: 'POST',
        body: { title: category, description: description.trim(), priority, category, flatId: flatId || undefined },
      });
      router.replace(c?.id ? { pathname: '/complaints/[id]', params: { id: c.id } } : '/complaints');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="Complaints" />
      <Body>
        <T weight="medium" style={{ fontSize: 19 }}>
          Raise A Complaint
        </T>
        {error && <ErrorBox text={error} />}
        <Field label="Complaint Category">
          <Chips value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ key: c.key, label: c.label }))} />
        </Field>
        <Field label="Description">
          <Input multiline value={description} onChangeText={setDescription} placeholder="What is wrong, and where? e.g. Leakage from the main pipe near B wing" />
        </Field>
        {flatOptions.length > 1 && (
          <Field label="Where">
            <Chips value={flatId} onChange={setFlatId} options={flatOptions} />
          </Field>
        )}
        <Field label="Priority Level">
          <Chips value={priority} onChange={setPriority} options={PRIORITIES as any} />
        </Field>
        <T style={{ color: C.sub, fontSize: 12 }}>Adding photos is coming soon.</T>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => router.back()} />
          <Button label="Submit" style={{ flex: 1 }} busy={busy} disabled={description.trim().length < 5} onPress={submit} />
        </View>
      </Body>
    </View>
  );
}
