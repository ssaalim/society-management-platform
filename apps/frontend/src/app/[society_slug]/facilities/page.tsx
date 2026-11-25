'use client';

import { useAuth } from '../../providers/auth-context';
import { FacilitiesView } from '@/components/facilities/facilities-view';

const RESIDENT_ROLES = ['OWNER', 'CO_OWNER', 'TENANT', 'FAMILY_MEMBER', 'MEMBER'];
/** Roles that record payments and refunds (accounting:write). */
const ACCOUNTS_ROLES = ['SUPER_ADMIN', 'SOCIETY_ADMIN', 'PRESIDENT', 'SECRETARY', 'TREASURER', 'ACCOUNTANT'];

export default function FacilitiesPage() {
  const { activeSociety } = useAuth();
  const role = activeSociety?.role || '';
  const isOffice = !!role && !RESIDENT_ROLES.includes(role);
  return <FacilitiesView key={activeSociety?.societyId} isOffice={isOffice} canAccount={ACCOUNTS_ROLES.includes(role)} />;
}
