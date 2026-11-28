import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Button, Card, IconBubble, IconName, Ionicons, T } from './ui';
import { C, shortDate, timeOf } from '@/lib/theme';

export const CATEGORIES: { key: string; label: string; icon: IconName }[] = [
  { key: 'Maintenance', label: 'Maintenance', icon: 'construct-outline' },
  { key: 'Water', label: 'Water', icon: 'water-outline' },
  { key: 'Parking', label: 'Parking', icon: 'car-outline' },
  { key: 'Electricity', label: 'Electricity', icon: 'flash-outline' },
  { key: 'Lift', label: 'Lift', icon: 'swap-vertical-outline' },
  { key: 'Others', label: 'Others', icon: 'ellipsis-horizontal' },
];

export interface Complaint {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  assignedStaffName: string | null;
  raisedByName: string | null;
  flatNumber: string | null;
  resolutionComment: string | null;
  residentFeedback: string | null;
  rating: number | null;
  escalationLevel: number;
  escalatedAt: string | null;
}

export const categoryOf = (title: string) => CATEGORIES.find((c) => title.toLowerCase().startsWith(c.key.toLowerCase())) || CATEGORIES[5];
export const isActive = (c: Complaint) => ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ESCALATED'].includes(c.status);
export const statusLabel = (s: string) =>
  ({ OPEN: 'Open', ASSIGNED: 'In progress', IN_PROGRESS: 'In progress', ESCALATED: 'Escalated', RESOLVED: 'Resolved', CLOSED: 'Closed' } as Record<string, string>)[s] || s;

export function ComplaintCard({ c }: { c: Complaint }) {
  const cat = categoryOf(c.title);
  const resolved = !isActive(c);
  return (
    <Card style={{ gap: 8, paddingTop: 16 }}>
      <Badge
        label={statusLabel(c.status)}
        tone={resolved ? 'green' : c.status === 'ESCALATED' ? 'red' : 'orange'}
        style={{ position: 'absolute', right: 0, top: 0, borderTopRightRadius: 14, borderTopLeftRadius: 0, borderBottomRightRadius: 0 }}
      />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <IconBubble name={cat.icon} color={C.orangeDeep} bg="#FBF2EE" size={50} />
        <View style={{ flex: 1, gap: 2 }}>
          <T style={{ fontSize: 17 }} numberOfLines={1}>
            {c.title}
          </T>
          <T style={{ color: C.sub }} numberOfLines={2}>
            {c.description}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Ionicons name="calendar-outline" size={15} color={C.orangeDeep} />
            <T style={{ fontSize: 13 }}>{shortDate(c.createdAt)}</T>
            <T style={{ color: C.faint }}> | </T>
            <Ionicons name="time-outline" size={15} color={C.orangeDeep} />
            <T style={{ fontSize: 13 }}>{timeOf(c.createdAt)}</T>
          </View>
        </View>
      </View>
      <Button label={resolved ? 'View' : 'Track'} small onPress={() => router.push({ pathname: '/complaints/[id]', params: { id: c.id } })} style={{ alignSelf: 'flex-end', minWidth: 130 }} />
    </Card>
  );
}
