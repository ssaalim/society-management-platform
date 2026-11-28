import React from 'react';
import { Alert, Platform } from 'react-native';
import { api, errMsg } from '@/lib/api';

export interface Visit {
  id: string;
  name: string;
  mobile: string | null;
  type: string;
  typeLabel: string;
  company: string | null;
  purpose: string | null;
  headcount: number | null;
  vehicleNumber: string | null;
  entryTime: string;
  enteredAt: string | null;
  exitTime: string | null;
  status: 'PENDING' | 'APPROVED' | 'INSIDE' | 'EXITED' | 'DENIED' | string;
  flatLabel: string;
  decidedByName: string | null;
  decisionNote: string | null;
  noResponse: boolean;
}

export const visitTab = (v: Visit) => (v.status === 'DENIED' ? 'declined' : v.status === 'EXITED' || v.noResponse ? 'past' : 'upcoming');

export const visitStatus = (v: Visit): { label: string; tone: 'orange' | 'green' | 'red' | 'purple' | 'grey' } =>
  v.status === 'PENDING'
    ? v.noResponse
      ? { label: 'No response', tone: 'grey' }
      : { label: 'Waiting for approval', tone: 'purple' }
    : v.status === 'APPROVED'
      ? { label: 'Approved', tone: 'green' }
      : v.status === 'INSIDE'
        ? { label: 'Inside', tone: 'green' }
        : v.status === 'EXITED'
          ? { label: 'Left', tone: 'grey' }
          : { label: 'Declined', tone: 'red' };

export function notify(title: string, body: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${body}`);
  else Alert.alert(title, body);
}

/** Approve or decline a visitor waiting at the gate. */
export async function decide(id: string, approve: boolean) {
  try {
    await api(`/visitors/${id}/decision`, { method: 'POST', body: { approve, note: null } });
    return true;
  } catch (e) {
    notify(approve ? 'Could not approve' : 'Could not decline', errMsg(e));
    return false;
  }
}

export const Noop = React.Fragment;
