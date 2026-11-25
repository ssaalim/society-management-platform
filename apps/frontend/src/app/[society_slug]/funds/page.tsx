'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '../../providers/auth-context';
import { FundsList } from '@/components/funds/funds-list';

/** Who runs funds; the server checks this too. */
const MANAGERS = ['SUPER_ADMIN', 'SOCIETY_ADMIN', 'PRESIDENT', 'SECRETARY', 'TREASURER', 'ACCOUNTANT'];

export default function FundsPage() {
  const { society_slug } = useParams<{ society_slug: string }>();
  const { activeSociety } = useAuth();
  return <FundsList key={activeSociety?.societyId} slug={society_slug} canManage={MANAGERS.includes(activeSociety?.role || '')} />;
}
