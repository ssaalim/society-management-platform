'use client';

import { useParams } from 'next/navigation';
import { FundDetail } from '@/components/funds/fund-detail';

export default function FundPage() {
  const { society_slug, fund_id } = useParams<{ society_slug: string; fund_id: string }>();
  return <FundDetail key={fund_id} slug={society_slug} fundId={fund_id} />;
}
