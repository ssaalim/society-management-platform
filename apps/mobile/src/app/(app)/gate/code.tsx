import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Body, Button, Card, Chips, ErrorBox, Header, Input, KV, T } from '@/components/ui';
import { api, errMsg } from '@/lib/api';
import { C, shortDate, timeOf } from '@/lib/theme';

interface Check {
  kind: 'PASS' | 'DAILY_HELP';
  valid: boolean;
  problem: string | null;
  pass?: { guestName: string; type: string; flatLabel: string; hostName: string | null; validUntil: string; usesCount: number; maxUses: number };
  help?: { name: string; category: string; mobile: string; flats: { flatId: string; flatLabel: string }[]; insideVisitId: string | null };
}

/** A guest pass or daily-help code: check it, then let the person in (or out, for daily help already inside). */
export default function EnterCode() {
  const [code, setCode] = useState('');
  const [check, setCheck] = useState<Check | null>(null);
  const [flatId, setFlatId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const lookUp = async () => {
    setBusy(true);
    setErr(null);
    setCheck(null);
    setDone(null);
    try {
      const c = await api<Check>(`/visitors/code/${encodeURIComponent(code.trim())}`);
      setCheck(c);
      setFlatId(c.help?.flats[0]?.flatId || '');
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const letIn = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/visitors/code/${encodeURIComponent(code.trim())}/enter`, { method: 'POST', body: { flatId: flatId || null, gateNo: null } });
      setDone(`${check?.pass?.guestName || check?.help?.name} is in.`);
      setCheck(null);
      setCode('');
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const markOut = async (id: string) => {
    setBusy(true);
    try {
      await api(`/visitors/${id}/exit`, { method: 'POST' });
      setDone(`${check?.help?.name} has left.`);
      setCheck(null);
      setCode('');
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="Enter code" />
      <Body>
        <T style={{ color: C.sub }}>Type the 6-digit code from the guest pass or the daily help card.</T>
        <Input
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          keyboardType="number-pad"
          maxLength={6}
          style={{ fontSize: 28, letterSpacing: 10, textAlign: 'center', height: 64 }}
          onSubmitEditing={lookUp}
          autoFocus
        />
        <Button label="Check" onPress={lookUp} busy={busy && !check} disabled={code.length !== 6} />
        {err && <ErrorBox text={err} />}
        {done && (
          <Card style={{ backgroundColor: C.greenSoft, borderColor: '#BFE3CA', gap: 8 }}>
            <T weight="medium">{done}</T>
            <Button label="Back to gate desk" small variant="outline" onPress={() => (router.canGoBack() ? router.back() : router.replace('/gate'))} />
          </Card>
        )}
        {check && (
          <Card style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T weight="medium" style={{ fontSize: 18 }}>
                {check.pass?.guestName || check.help?.name}
              </T>
              <Badge label={check.valid ? 'Valid' : 'Not valid'} tone={check.valid ? 'green' : 'red'} />
            </View>
            {check.pass && (
              <>
                <KV k="Guest pass for" v={`Flat ${check.pass.flatLabel}`} />
                {check.pass.hostName && <KV k="Invited by" v={check.pass.hostName.replace(/\s*\(.*\)$/, '')} />}
                <KV k="Valid till" v={`${shortDate(check.pass.validUntil)} ${timeOf(check.pass.validUntil)}`} />
                <KV k="Used" v={`${check.pass.usesCount} of ${check.pass.maxUses}`} />
              </>
            )}
            {check.help && (
              <>
                <KV k="Daily help" v={check.help.category.toLowerCase()} />
                {check.help.flats.length > 1 && !check.help.insideVisitId && (
                  <View style={{ gap: 6, marginTop: 6 }}>
                    <T style={{ color: C.sub }}>Going to</T>
                    <Chips value={flatId} onChange={setFlatId} options={check.help.flats.map((f) => ({ key: f.flatId, label: f.flatLabel }))} />
                  </View>
                )}
                {check.help.flats.length === 1 && <KV k="Works at" v={`Flat ${check.help.flats[0].flatLabel}`} />}
              </>
            )}
            {check.problem && <ErrorBox text={check.problem} />}
            {check.valid &&
              (check.help?.insideVisitId ? (
                <Button label="Mark exit" icon="exit-outline" busy={busy} onPress={() => markOut(check.help!.insideVisitId!)} style={{ marginTop: 8 }} />
              ) : (
                <Button label="Let in" icon="enter-outline" busy={busy} onPress={letIn} style={{ marginTop: 8 }} />
              ))}
          </Card>
        )}
      </Body>
    </View>
  );
}
