'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { NativeSelect } from '@/components/ui/native-select';

export interface BankAccountOption {
  id: string;
  bankName: string;
  last4: string;
  isDefault: boolean;
  ledgerName: string;
}

/** Where money was paid from: cash, or a bank account (null = the society's default bank account). */
export interface PaidFrom {
  paymentMode: 'BANK' | 'CASH';
  bankAccountId: string | null;
}

/** The society's bank accounts, default first. Empty while loading or when none are set up. */
export function useBankAccounts() {
  const [accounts, setAccounts] = useState<BankAccountOption[]>([]);
  useEffect(() => {
    let alive = true;
    apiClient
      .get('/accounting/bank-accounts')
      .then((res) => alive && setAccounts(res.data?.data || []))
      .catch(() => alive && setAccounts([]));
    return () => {
      alive = false;
    };
  }, []);
  return accounts;
}

export const bankLabel = (a: BankAccountOption) => `${a.bankName} ••${a.last4}${a.isDefault ? ' (default)' : ''}`;

/**
 * One dropdown for "Paid from": each bank account, then cash. With no account chosen yet, the default account is shown
 * selected, which is also what the server uses.
 */
export function PaidFromSelect({
  id,
  value,
  onChange,
  accounts,
  disabled,
  className,
}: {
  id?: string;
  value: PaidFrom;
  onChange: (v: PaidFrom) => void;
  accounts: BankAccountOption[];
  disabled?: boolean;
  className?: string;
}) {
  const fallback = accounts[0]?.id ?? 'BANK';
  const selected = value.paymentMode === 'CASH' ? 'CASH' : value.bankAccountId || fallback;
  return (
    <NativeSelect
      id={id}
      className={className}
      disabled={disabled}
      value={selected}
      onChange={(e) => {
        const v = e.target.value;
        if (v === 'CASH') onChange({ paymentMode: 'CASH', bankAccountId: null });
        else onChange({ paymentMode: 'BANK', bankAccountId: v === 'BANK' ? null : v });
      }}
    >
      {accounts.length === 0 && <option value="BANK">Bank account</option>}
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {bankLabel(a)}
        </option>
      ))}
      <option value="CASH">Cash in hand</option>
    </NativeSelect>
  );
}
