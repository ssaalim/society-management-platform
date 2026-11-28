'use client';

import { useAuth } from '../../providers/auth-context';
import { GateDesk } from '@/components/visitors/gate-desk';
import { ResidentVisitors } from '@/components/visitors/resident-visitors';

/** Security and the office get the gate desk; everyone else sees visitors for their own flat. */
const GATE_ROLES = ['SECURITY_SUPERVISOR', 'ESTATE_MANAGER', 'SUPER_ADMIN', 'SOCIETY_ADMIN', 'PRESIDENT', 'SECRETARY'];

export default function VisitorsPage() {
  const { activeSociety } = useAuth();
  const role = activeSociety?.role || '';
  return GATE_ROLES.includes(role) ? <GateDesk key={activeSociety?.societyId} /> : <ResidentVisitors key={activeSociety?.societyId} />;
}
