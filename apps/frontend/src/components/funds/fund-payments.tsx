'use client';

import React, { useState } from 'react';
import { Check, Clock, X } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { bankLabel, useBankAccounts } from '@/components/accounting/paid-from-select';
import { fmtDate, rupees, todayIST } from './fund-utils';

export interface Claim {
  id: string;
  shareId: string | null;
  flatId: string | null;
  flatLabel: string | null;
  amount: string;
  paidAt: string;
  paymentMode: string;
  reference: string | null;
  note: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedBy: string | null;
  submittedByName: string | null;
  rejectReason: string | null;
  createdAt: string;
}

/** A resident tells the office they paid by UPI / transfer / cheque; the treasurer or a committee member confirms it. */
export function ClaimDialog({
  title,
  maxAmount,
  defaultAmount,
  onClose,
  onSave,
}: {
  title: string;
  maxAmount: number | null;
  defaultAmount: number | null;
  onClose: () => void;
  onSave: (body: { amount: number; paidAt: string; paymentMode: string; reference: string | null; note: string | null }) => void;
}) {
  const [d, setD] = useState({ amount: defaultAmount ? String(defaultAmount) : '', paidAt: todayIST(), paymentMode: 'UPI', reference: '', note: '' });
  const amount = Number(d.amount);
  const tooMuch = maxAmount !== null && amount > maxAmount;
  return (
    <Dialog open onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>The treasurer or a committee member checks it against the bank statement. Until then it still shows as due.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cl-amount">Amount paid (₹)</Label>
            <Input id="cl-amount" type="number" min="1" value={d.amount} onChange={(e) => setD({ ...d, amount: e.target.value })} />
            {tooMuch && <p className="text-xs text-red-600 dark:text-red-400">Only {rupees(maxAmount!)} is due.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cl-date">Paid on</Label>
            <Input id="cl-date" type="date" max={todayIST()} value={d.paidAt} onChange={(e) => setD({ ...d, paidAt: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cl-mode">How</Label>
            <NativeSelect id="cl-mode" value={d.paymentMode} onChange={(e) => setD({ ...d, paymentMode: e.target.value })}>
              <option value="UPI">UPI</option>
              <option value="NEFT">Bank transfer (NEFT/IMPS)</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CASH">Cash (handed over)</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cl-ref">Reference no. (optional)</Label>
            <Input id="cl-ref" value={d.reference} placeholder="UTR / UPI ref / cheque no." onChange={(e) => setD({ ...d, reference: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cl-note">Note (optional)</Label>
            <Input id="cl-note" value={d.note} placeholder="e.g. Paid from my wife's account" onChange={(e) => setD({ ...d, note: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!amount || tooMuch}
            onClick={() => onSave({ amount, paidAt: d.paidAt, paymentMode: d.paymentMode, reference: d.reference.trim() || null, note: d.note.trim() || null })}
          >
            Send for approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Pending reports for approvers, and a resident's own reports with their outcome. */
export function ClaimsCard({
  claims,
  canApprove,
  myUserId,
  busy,
  onApprove,
  onReject,
}: {
  claims: Claim[];
  canApprove: boolean;
  myUserId: string | null;
  busy: boolean;
  onApprove: (c: Claim) => void;
  onReject: (c: Claim) => void;
}) {
  if (!claims.length) return null;
  const pending = claims.filter((c) => c.status === 'PENDING');
  // Approvers see what waits on them plus recent outcomes; residents see their own.
  const shown = canApprove ? [...pending, ...claims.filter((c) => c.status !== 'PENDING').slice(0, 5)] : claims;
  return (
    <Card className={canApprove && pending.length ? 'border-amber-300 dark:border-amber-700' : ''}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" /> {canApprove ? 'Payments reported by residents' : 'Payments you reported'}
        </CardTitle>
        {canApprove && (
          <CardDescription>
            {pending.length ? `${pending.length} waiting. Check each against the bank statement before approving.` : 'Nothing waiting for approval.'}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-1.5">
        {shown.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
            <span>
              <span className="font-medium">{c.flatLabel || '—'}</span>
              {c.submittedByName && <span className="text-muted-foreground"> · {c.submittedByName.replace(/\s*\(.*\)$/, '')}</span>}
              <span className="block text-xs text-muted-foreground">
                Paid {fmtDate(c.paidAt)} · {c.paymentMode}
                {c.reference ? ` ${c.reference}` : ''}
                {c.note ? ` · ${c.note}` : ''}
              </span>
              {c.status === 'REJECTED' && c.rejectReason && <span className="block text-xs text-red-600 dark:text-red-400">Not confirmed: {c.rejectReason}</span>}
            </span>
            <span className="flex items-center gap-2">
              <span className="tabular-nums">{rupees(c.amount)}</span>
              {c.status === 'PENDING' ? (
                canApprove && c.submittedBy !== myUserId ? (
                  <>
                    <Button size="sm" className="h-7" disabled={busy} onClick={() => onApprove(c)}>
                      <Check /> Approve
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7" disabled={busy} onClick={() => onReject(c)}>
                      <X /> Reject
                    </Button>
                  </>
                ) : (
                  <Badge variant="warning">Waiting for approval</Badge>
                )
              ) : c.status === 'APPROVED' ? (
                <Badge variant="success">Confirmed</Badge>
              ) : (
                <Badge variant="muted">Not confirmed</Badge>
              )}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Approve: say which account the money arrived in, then it is recorded with a receipt. */
export function ApproveDialog({ claim, onClose, onSave }: { claim: Claim; onClose: () => void; onSave: (body: { bankAccountId: string | null; paidAt: string }) => void }) {
  const accounts = useBankAccounts();
  const [bankAccountId, setBankAccountId] = useState('');
  const [paidAt, setPaidAt] = useState(claim.paidAt);
  const cash = claim.paymentMode === 'CASH';
  return (
    <Dialog open onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Approve {rupees(claim.amount)} from {claim.flatLabel || 'a member'}?
          </DialogTitle>
          <DialogDescription>
            {claim.paymentMode}
            {claim.reference ? ` ref ${claim.reference}` : ''}, paid {fmtDate(claim.paidAt)}. It is recorded as received, with a receipt, and the flat is told.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {!cash && accounts.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="ap-bank">Arrived in</Label>
              <NativeSelect id="ap-bank" value={bankAccountId || accounts[0].id} onChange={(e) => setBankAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {bankLabel(a)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ap-date">Received on</Label>
            <Input id="ap-date" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave({ bankAccountId: cash ? null : bankAccountId || accounts[0]?.id || null, paidAt })}>
            <Check /> Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A reason is required (rejecting a report, reversing a payment). */
export function ReasonDialog({
  title,
  description,
  confirm,
  placeholder,
  onClose,
  onSave,
}: {
  title: string;
  description: string;
  confirm: string;
  placeholder: string;
  onClose: () => void;
  onSave: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <Dialog open onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="rs-reason">Reason</Label>
          <Input id="rs-reason" value={reason} placeholder={placeholder} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!reason.trim()} onClick={() => onSave(reason.trim())}>
            {confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------------------------------------ online (Razorpay)

let checkoutScript: Promise<void> | null = null;
function loadCheckout(): Promise<void> {
  if ((window as any).Razorpay) return Promise.resolve();
  checkoutScript ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => {
      checkoutScript = null;
      reject(new Error('Could not load the payment page. Check your internet connection.'));
    };
    document.body.appendChild(s);
  });
  return checkoutScript;
}

/**
 * Opens Razorpay checkout for a share (or a voluntary amount). Resolves with the updated fund once the payment is
 * verified, or null if the resident closed the checkout.
 */
export async function payOnline(fundId: string, body: { shareId: string | null; amount: number | null }, who: { name?: string; email?: string }) {
  const order = (await apiClient.post(`/funds/${fundId}/online/order`, body)).data.data;
  await loadCheckout();
  return new Promise<any>((resolve, reject) => {
    const rzp = new (window as any).Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: order.name,
      description: 'Fund contribution',
      prefill: { name: who.name, email: who.email },
      theme: { color: '#2563eb' },
      handler: async (resp: any) => {
        try {
          const res = await apiClient.post('/funds/online/verify', {
            orderId: resp.razorpay_order_id,
            paymentId: resp.razorpay_payment_id,
            signature: resp.razorpay_signature,
          });
          resolve(res.data.data);
        } catch (err) {
          reject(err);
        }
      },
      modal: { ondismiss: () => resolve(null) },
    });
    rzp.on('payment.failed', (r: any) => reject(new Error(r?.error?.description || 'The payment failed. No money was taken.')));
    rzp.open();
  });
}
