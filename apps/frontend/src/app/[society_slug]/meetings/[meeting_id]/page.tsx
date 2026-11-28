'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '../../../providers/auth-context';
import { MeetingDetail } from '@/components/meetings/meeting-detail';

export default function MeetingPage() {
  const { society_slug, meeting_id } = useParams<{ society_slug: string; meeting_id: string }>();
  const { user } = useAuth() as any;
  return (
    <Suspense>
      <MeetingDetail key={meeting_id} slug={society_slug} meetingId={meeting_id} myUserId={user?.id ?? null} />
    </Suspense>
  );
}
