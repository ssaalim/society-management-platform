import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Header, IconBubble, Input, SectionTitle, T } from '@/components/ui';
import { api, errMsg } from '@/lib/api';
import { C } from '@/lib/theme';

const SUGGESTIONS = ['When is maintenance due?', 'How do I book the clubhouse?', 'What are the parking rules?'];

/** Ask the society assistant, or reach the office and committee. */
export default function Help() {
  const [msgs, setMsgs] = useState<{ from: 'me' | 'bot'; text: string }[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef<any>(null);

  const ask = async (q: string) => {
    if (!q.trim() || busy) return;
    setMsgs((m) => [...m, { from: 'me', text: q.trim() }]);
    setText('');
    setBusy(true);
    try {
      const r = await api<{ reply: string }>('/ai/chat', { method: 'POST', body: { message: q.trim() } });
      setMsgs((m) => [...m, { from: 'bot', text: r?.reply || 'Sorry, I could not find an answer. Please ask the office.' }]);
    } catch (e) {
      setMsgs((m) => [...m, { from: 'bot', text: errMsg(e) }]);
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Help" back={false} />
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: C.orangeSoft, borderColor: C.orangeLine }}>
          <IconBubble name="sparkles" color={C.orangeDeep} size={44} />
          <View style={{ flex: 1 }}>
            <T weight="medium">Society assistant</T>
            <T style={{ color: C.sub, fontSize: 13 }}>Ask about rules, dues, facilities or notices.</T>
          </View>
        </Card>
        {!msgs.length && (
          <View style={{ gap: 8 }}>
            {SUGGESTIONS.map((q) => (
              <Card key={q} onPress={() => ask(q)} style={{ paddingVertical: 10 }}>
                <T style={{ color: C.text }}>{q}</T>
              </Card>
            ))}
          </View>
        )}
        {msgs.map((m, i) => (
          <View
            key={i}
            style={{
              alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              backgroundColor: m.from === 'me' ? C.orange : C.card,
              borderColor: C.line,
              borderWidth: m.from === 'me' ? 0 : 1,
              borderRadius: 14,
              padding: 12,
            }}
          >
            <T style={{ color: m.from === 'me' ? '#fff' : C.text }}>{m.text}</T>
          </View>
        ))}
        {busy && <T style={{ color: C.sub }}>Thinking…</T>}

        <SectionTitle>Contact</SectionTitle>
        <Card onPress={() => router.push('/committee')} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <IconBubble name="people" color="#4FA77A" bg={C.card} size={40} />
          <View style={{ flex: 1 }}>
            <T weight="medium">Committee and office</T>
            <T style={{ color: C.sub, fontSize: 13 }}>See who handles what and how to reach them</T>
          </View>
        </Card>
        <Card onPress={() => router.push('/complaints/new')} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <IconBubble name="bug" color={C.red} bg={C.card} size={40} />
          <View style={{ flex: 1 }}>
            <T weight="medium">Report a problem</T>
            <T style={{ color: C.sub, fontSize: 13 }}>Something broken in the building? Raise a complaint</T>
          </View>
        </Card>
        {process.env.EXPO_PUBLIC_SUPPORT_EMAIL ? (
          <Card onPress={() => Linking.openURL(`mailto:${process.env.EXPO_PUBLIC_SUPPORT_EMAIL}?subject=Housive app`)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <IconBubble name="mail" color="#5B7CFA" bg={C.card} size={40} />
            <T weight="medium" style={{ flex: 1 }}>
              Problem with the app? Email support
            </T>
          </Card>
        ) : null}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: '#fff' }}>
        <Input value={text} onChangeText={setText} placeholder="Ask a question" style={{ flex: 1, height: 46 }} onSubmitEditing={() => ask(text)} returnKeyType="send" />
        <Button label="Ask" small onPress={() => ask(text)} disabled={!text.trim()} busy={busy} style={{ alignSelf: 'center' }} />
      </View>
    </KeyboardAvoidingView>
  );
}
