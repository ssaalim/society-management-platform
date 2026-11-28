import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, ErrorBox, Field, Header, Input, T } from '@/components/ui';
import { api, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { C } from '@/lib/theme';

/** First sign-in (or a reset): the code from the society office, then the member's own password. */
export default function Activate() {
  const insets = useSafeAreaInsets();
  const { adoptSession } = useAuth();
  const [code, setCode] = useState('');
  const [who, setWho] = useState<{ email: string; name: string; societyName: string } | null>(null);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const check = async () => {
    setBusy(true);
    setErr(null);
    try {
      setWho(await api('/auth/invite/check', { method: 'POST', body: { code } }));
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const activate = async () => {
    setBusy(true);
    setErr(null);
    try {
      const session = await api<any>('/auth/invite/activate', { method: 'POST', body: { code, email, password: pw } });
      await adoptSession(session);
    } catch (e) {
      setErr(errMsg(e));
      setBusy(false);
    }
  };

  const mismatch = pw2.length > 0 && pw !== pw2;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Activate your account" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        {err && <ErrorBox text={err} />}
        {!who ? (
          <>
            <T style={{ color: C.sub }}>Enter the 8-character code your society office sent you (on WhatsApp, SMS or email).</T>
            <Field label="Invite code">
              <Input
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                placeholder="ABCD-1234"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={9}
                style={{ fontSize: 22, letterSpacing: 4, textAlign: 'center', height: 60 }}
                onSubmitEditing={check}
              />
            </Field>
            <Button label="Continue" busy={busy} disabled={code.replace(/[^A-Za-z0-9]/g, '').length !== 8} onPress={check} />
          </>
        ) : (
          <>
            <Card style={{ backgroundColor: C.orangeSoft, borderColor: C.orangeLine, gap: 2 }}>
              <T weight="medium">Welcome{who.name ? `, ${who.name}` : ''}!</T>
              <T style={{ color: C.sub }}>{who.societyName}</T>
            </Card>
            <Field label="Your email" hint="The email your society office has for you.">
              <Input value={email} onChangeText={setEmail} placeholder={who.email.replace(/^(.).*(@.*)$/, '$1•••$2')} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            </Field>
            <Field label="Choose a password" hint="At least 8 characters.">
              <Input value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
            </Field>
            <Field label="Type it again">
              <Input value={pw2} onChangeText={setPw2} secureTextEntry autoComplete="new-password" textContentType="newPassword" onSubmitEditing={activate} />
            </Field>
            {mismatch && <T style={{ color: C.red, fontSize: 13 }}>The passwords do not match.</T>}
            <Button label="Activate and sign in" busy={busy} disabled={!email.trim() || pw.length < 8 || pw !== pw2} onPress={activate} />
            <View style={{ alignItems: 'center' }}>
              <T style={{ color: C.sub, textDecorationLine: 'underline' }} onPress={() => setWho(null)}>
                Use a different code
              </T>
            </View>
          </>
        )}
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <T style={{ color: C.sub }} onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}>
            Already have a password? <T style={{ color: C.orange }}>Sign in</T>
          </T>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
