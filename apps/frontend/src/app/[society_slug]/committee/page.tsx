'use client';

import { useAuth } from '../../providers/auth-context';
import { CommitteeView } from '@/components/committee/committee-view';

/** Who may change the committee (it changes people's app access); the server checks this too. */
const MANAGERS = ['SUPER_ADMIN', 'SOCIETY_ADMIN', 'PRESIDENT', 'SECRETARY'];

export default function CommitteePage() {
  const { activeSociety } = useAuth();
  return <CommitteeView key={activeSociety?.societyId} canManage={MANAGERS.includes(activeSociety?.role || '')} />;
}
