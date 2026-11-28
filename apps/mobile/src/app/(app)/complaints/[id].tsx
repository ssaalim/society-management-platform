import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Badge, Body, Button, Card, ErrorBox, Header, IconBubble, Input, Ionicons, T } from '@/components/ui';
import { Complaint, categoryOf, isActive, statusLabel } from '@/components/complaints';
import { api, errMsg } from '@/lib/api';
import { cleanName } from '@/lib/auth';
import { useApi } from '@/lib/use-api';
import { C, shortDate, timeOf } from '@/lib/theme';

const when = (iso: string | null) => (iso ? `${shortDate(iso)} | ${timeOf(iso)}` : '');

/** Track a complaint: raised → assigned → resolved, with feedback once resolved. */
export default function TrackComplaint() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<Complaint[]>('/complaints');
  const c = data?.find((x) => x.id === id);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const steps = c
    ? [
        { label: 'You raised a request', at: c.createdAt, done: true },
        { label: c.assignedStaffName ? `Assigned to ${c.assignedStaffName}` : 'Notified to the office', at: c.assignedStaffName ? c.updatedAt : c.createdAt, done: true },
        ...(c.escalationLevel > 0 ? [{ label: `Escalated (level ${c.escalationLevel})`, at: c.escalatedAt, done: true }] : []),
        { label: 'Work in progress', at: null, done: !!c.assignedStaffName || !isActive(c) },
        { label: 'Resolved', at: c.resolvedAt, done: !isActive(c) },
      ]
    : [];

  const sendFeedback = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/complaints/${id}/feedback`, { method: 'POST', body: { feedback: feedback.trim() || 'Thank you', rating: rating || undefined } });
      reload();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="Track Complaint" />
      <Body loading={loading && !data} error={error || (data && !c ? 'Complaint not found.' : null)} onRefresh={reload}>
        {c && (
          <>
            <Card style={{ gap: 14, padding: 18 }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <IconBubble name={categoryOf(c.title).icon} color={C.orangeDeep} bg="#FBF2EE" size={52} />
                <View style={{ flex: 1 }}>
                  <T style={{ fontSize: 18 }}>{c.title}</T>
                  <T style={{ color: C.faint }}>#{c.id.slice(0, 6).toUpperCase()}</T>
                </View>
                <Badge label={statusLabel(c.status)} tone={isActive(c) ? 'orange' : 'green'} />
              </View>
              <T style={{ color: C.sub }}>{c.description}</T>
              <View style={{ backgroundColor: '#FBF5F3', borderColor: '#F3E1DA', borderWidth: 1, borderRadius: 10, padding: 14, gap: 10 }}>
                <Line icon="calendar-outline" text={`Complaint raised on ${shortDate(c.createdAt)}`} />
                <Line icon="time-outline" text={timeOf(c.createdAt)} />
                <Line icon="person-outline" text={`Raised by ${cleanName(c.raisedByName)}${c.flatNumber ? ` · Flat ${c.flatNumber}` : ' · Common area'}`} />
                <Line icon="flag-outline" text={`Priority ${c.priority.toLowerCase()}`} />
              </View>
              <T weight="medium" style={{ fontSize: 16 }}>
                Tracking Status
              </T>
              <View>
                {steps.map((s, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 14 }}>
                    <View style={{ alignItems: 'center' }}>
                      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: s.done ? C.orange : '#EFE9DF', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="checkmark" size={18} color="#fff" />
                      </View>
                      {i < steps.length - 1 && <View style={{ width: 1.5, flex: 1, minHeight: 24, backgroundColor: '#E4DCCB' }} />}
                    </View>
                    <View style={{ paddingBottom: 18, flex: 1 }}>
                      <T style={{ color: s.done ? C.text : C.sub }}>{s.label}</T>
                      {s.at && <T style={{ color: C.orangeDeep, fontSize: 12 }}>{when(s.at)}</T>}
                    </View>
                  </View>
                ))}
              </View>
              {c.resolutionComment && (
                <View style={{ backgroundColor: C.greenSoft, padding: 12, borderRadius: 10 }}>
                  <T style={{ fontSize: 13 }}>Office note: {c.resolutionComment}</T>
                </View>
              )}
            </Card>

            {!isActive(c) && !c.residentFeedback && (
              <Card style={{ gap: 12 }}>
                <T weight="medium">How was it handled?</T>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable key={n} onPress={() => setRating(n)} accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}>
                      <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={30} color={C.orange} />
                    </Pressable>
                  ))}
                </View>
                <Input value={feedback} onChangeText={setFeedback} placeholder="Anything to add? (optional)" />
                {err && <ErrorBox text={err} />}
                <Button label="Send feedback" busy={busy} disabled={!rating} onPress={sendFeedback} />
              </Card>
            )}
            {c.residentFeedback && (
              <Card>
                <T style={{ color: C.sub }}>
                  Your feedback{c.rating ? ` (${c.rating}★)` : ''}: {c.residentFeedback}
                </T>
              </Card>
            )}
            <Button label="Go Back" variant="outline" onPress={() => router.back()} />
          </>
        )}
      </Body>
    </View>
  );
}

function Line({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
      <Ionicons name={icon} size={18} color={C.orangeDeep} />
      <T style={{ color: C.sub, flex: 1 }}>{text}</T>
    </View>
  );
}
