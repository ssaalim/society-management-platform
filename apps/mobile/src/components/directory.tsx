import React from 'react';
import { View } from 'react-native';
import { Avatar, Badge, Ionicons, T } from './ui';
import { C } from '@/lib/theme';

export interface DirFlat {
  id: string;
  number: string;
  floor: number | null;
  occupancy: 'OWNER' | 'TENANT' | 'EMPTY';
  residents: { name: string; kind: 'OWNER' | 'TENANT' }[];
}
export interface DirWing {
  id: string;
  name: string;
  buildingName: string | null;
  flatCount: number;
  occupied: number;
  flats: DirFlat[];
}

export const OCCUPANCY: Record<DirFlat['occupancy'], { label: string; tone: 'green' | 'purple' | 'grey' }> = {
  OWNER: { label: 'Owner occupied', tone: 'green' },
  TENANT: { label: 'Rented', tone: 'purple' },
  EMPTY: { label: 'Empty', tone: 'grey' },
};

export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

/** One flat as in the mockup: a grey title bar with the flat number, then each resident (name and Owner/Tenant). */
export function FlatCard({ f, wingName }: { f: DirFlat; wingName?: string }) {
  const occ = OCCUPANCY[f.occupancy];
  return (
    <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 10, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F1F3F8', paddingHorizontal: 14, paddingVertical: 10 }}>
        <Ionicons name="business-outline" size={20} color="#8A93A6" />
        <T weight="medium" style={{ fontSize: 16, flex: 1 }}>
          Flat {f.number}
          {wingName ? <T style={{ color: C.sub, fontSize: 13 }}> · {wingName}</T> : null}
        </T>
        <Badge label={occ.label} tone={occ.tone} />
      </View>
      {f.residents.length ? (
        f.residents.map((r, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Avatar name={r.name} size={40} />
            <View>
              <T style={{ fontSize: 15 }}>{r.name}</T>
              <T style={{ color: C.faint, fontSize: 12 }}>{r.kind === 'OWNER' ? 'Owner' : 'Tenant'}</T>
            </View>
          </View>
        ))
      ) : (
        <T style={{ color: C.faint, paddingHorizontal: 14, paddingVertical: 12 }}>No one lives here at the moment.</T>
      )}
    </View>
  );
}
