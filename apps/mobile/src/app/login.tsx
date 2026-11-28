import React, { useState } from 'react';
import { router } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { Button, ErrorBox, Field, Input, Ionicons, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { errMsg } from '@/lib/api';
import { C } from '@/lib/theme';

/** Building mark, in the spirit of the mockup's logo. */
function Logo() {
  return (
    <Svg width={120} height={110} viewBox="0 0 120 110">
      <Path d="M10 70 A50 50 0 0 1 110 50" stroke="#3E8E6A" strokeWidth={3} fill="none" />
      <Rect x={30} y={30} width={26} height={62} fill="#2F3A4A" rx={2} />
      <Rect x={56} y={18} width={22} height={74} fill="#F2F4F7" stroke="#2F3A4A" strokeWidth={2} rx={2} />
      <Rect x={78} y={46} width={16} height={46} fill="#4FA77A" rx={2} />
      {[0, 1, 2, 3, 4].map((r) => (
        <React.Fragment key={r}>
          <Rect x={35} y={38 + r * 10} width={5} height={5} fill="#8FD3B0" />
          <Rect x={45} y={38 + r * 10} width={5} height={5} fill="#8FD3B0" />
          <Rect x={61} y={28 + r * 11} width={5} height={6} fill="#4FA77A" />
          <Rect x={69} y={28 + r * 11} width={5} height={6} fill="#4FA77A" />
        </React.Fragment>
      ))}
      <Path d="M14 84 Q60 108 106 80" stroke="#3E8E6A" strokeWidth={6} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

export default function Login() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const tell = (title: string, body: string) => (Platform.OS === 'web' ? window.alert(`${title}\n\n${body}`) : Alert.alert(title, body));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.header }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={[st.top, { paddingTop: insets.top + 48 }]}>
          <Logo />
          <T weight="semibold" style={{ fontSize: 22, letterSpacing: 2, color: '#2F3A4A' }}>
            HOUSIVE
          </T>
          <T style={{ color: C.sub }}>Your society, in your pocket</T>
        </View>
        <View style={[st.sheet, { paddingBottom: insets.bottom + 28 }]}>
          <T weight="medium" style={{ fontSize: 26, textAlign: 'center', marginBottom: 8 }}>
            Login
          </T>
          {error && <ErrorBox text={error} />}
          <Field label="E-mail">
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
            />
          </Field>
          <Field label="Password">
            <View>
              <Input
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                secureTextEntry={!show}
                autoComplete="password"
                textContentType="password"
                onSubmitEditing={submit}
                style={{ paddingRight: 48 }}
              />
              <Pressable onPress={() => setShow(!show)} style={st.eye} hitSlop={8} accessibilityLabel={show ? 'Hide password' : 'Show password'}>
                <Ionicons name={show ? 'eye-outline' : 'eye-off-outline'} size={22} color={C.sub} />
              </Pressable>
            </View>
          </Field>
          <Pressable
            style={{ alignSelf: 'flex-end' }}
            onPress={() => tell('Forgot your password?', 'Ask your society office for an invite code, then tap "Have an invite code?" to choose a new password.')}
          >
            <T style={{ color: C.sub, textDecorationLine: 'underline' }}>Forgot Password?</T>
          </Pressable>
          <Button label="Login" onPress={submit} busy={busy} disabled={!email.trim() || !password} style={{ marginTop: 8 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 4 }}>
            <T style={{ color: C.sub }}>New here?</T>
            <Pressable onPress={() => router.push('/activate')}>
              <T weight="medium" style={{ color: C.orange }}>
                Have an invite code?
              </T>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  top: { alignItems: 'center', gap: 6, paddingBottom: 40 },
  sheet: { flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, gap: 16 },
  eye: { position: 'absolute', right: 14, top: 14 },
});
