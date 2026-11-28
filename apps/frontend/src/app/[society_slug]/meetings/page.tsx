'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '../../providers/auth-context';
import { MeetingsList } from '@/components/meetings/meetings-list';

/** Who runs meetings; the server checks this too. */
const MANAGERS = ['SUPER_ADMIN', 'SOCIETY_ADMIN', 'PRESIDENT', 'SECRETARY', 'JOINT_SECRETARY'];

export default function MeetingsPage() {
  const { society_slug } = useParams<{ society_slug: string }>();
  const { activeSociety } = useAuth();
  return <MeetingsList key={activeSociety?.societyId} slug={society_slug} canManage={MANAGERS.includes(activeSociety?.role || '')} />;
}
