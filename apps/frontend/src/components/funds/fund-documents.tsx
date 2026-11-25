'use client';

import React from 'react';
import { LetterheadBlock, PrintSheet, Signatures, useLetterhead } from '@/components/print/print-sheet';
import { fmtDate, rupees, todayIST } from './fund-utils';

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const rest = r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? ` ${ONES[r % 10]}` : ''}`;
  return [h ? `${ONES[h]} Hundred` : '', rest].filter(Boolean).join(' ');
}

/** Rupees in words, Indian style (lakh, crore): 125000.5 → "Rupees One Lakh Twenty Five Thousand and Fifty Paise Only". */
export function inWords(amount: number): string {
  const rupeesPart = Math.floor(amount);
  const paise = Math.round((amount - rupeesPart) * 100);
  const parts: string[] = [];
  let n = rupeesPart;
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${below1000(crore)} Crore`);
  if (lakh) parts.push(`${below1000(lakh)} Lakh`);
  if (thousand) parts.push(`${below1000(thousand)} Thousand`);
  if (n) parts.push(below1000(n));
  const words = parts.join(' ') || 'Zero';
  return `Rupees ${words}${paise ? ` and ${below1000(paise)} Paise` : ''} Only`;
}

interface FundRef {
  name: string;
  description: string | null;
  dueDate: string | null;
}

/** A flat's demand (contribution notice) for its share of a fund. */
export function DemandDocument({
  fund,
  share,
  onClose,
}: {
  fund: FundRef;
  share: { invoiceNumber: string; flatLabel: string; flatType: string; amount: string; paidAmount: string; due: number; status: string; createdAt?: string };
  onClose: () => void;
}) {
  const lh = useLetterhead();
  return (
    <PrintSheet title={`Demand ${share.invoiceNumber} - ${share.flatLabel}`} onClose={onClose}>
      <LetterheadBlock lh={lh} />
      <h1 className="mb-4 text-center text-lg font-bold uppercase underline">Contribution Demand</h1>
      <div className="mb-4 flex justify-between text-xs">
        <span>No. {share.invoiceNumber}</span>
        <span>Date: {fmtDate(todayIST())}</span>
      </div>
      <p>
        To,
        <br />
        The Member, Flat <b>{share.flatLabel}</b>
        {share.flatType ? ` (${share.flatType})` : ''}
      </p>
      <p className="mt-3">
        As decided by the society, a fund is being collected for <b>{fund.name}</b>.{fund.description ? ` ${fund.description}` : ''}{' '}
        Your flat&apos;s share is as below. This is separate from the maintenance bill.
      </p>
      <table className="mt-4 w-full border-collapse text-[13px]">
        <tbody>
          <Row label="Share for your flat" value={rupees(share.amount)} />
          <Row label="Paid so far" value={rupees(share.paidAmount)} />
          <Row label="Amount due" value={share.status === 'WAIVED' ? 'Waived' : rupees(share.due)} bold />
          {fund.dueDate && <Row label="Please pay by" value={fmtDate(fund.dueDate)} />}
        </tbody>
      </table>
      {share.status !== 'WAIVED' && share.due > 0 && <p className="mt-2 text-[12px] italic">{inWords(share.due)}</p>}
      <p className="mt-4 text-[12px]">
        Pay at the society office or by bank transfer / UPI to the society&apos;s account, quoting demand no. {share.invoiceNumber}. If you pay by transfer, report it in
        the app with the reference number so the office can confirm it.
      </p>
      <div className="mt-12 text-right">
        <div>For {lh?.name || 'the society'}</div>
        <div className="mt-10">Hon. Treasurer</div>
      </div>
    </PrintSheet>
  );
}

/** The receipt for a payment into a fund. */
export function ReceiptDocument({
  fund,
  payment,
  onClose,
}: {
  fund: FundRef;
  payment: { receiptNumber: string; flatLabel: string | null; payerName: string | null; amount: string; paidAt: string; paymentMode: string; reference: string | null; reversedAt?: string | null };
  onClose: () => void;
}) {
  const lh = useLetterhead();
  const from = [payment.payerName, payment.flatLabel ? `Flat ${payment.flatLabel}` : null].filter(Boolean).join(', ');
  return (
    <PrintSheet title={`Receipt ${payment.receiptNumber}`} onClose={onClose}>
      {payment.reversedAt && <div className="mb-3 border border-red-500 p-1 text-center text-xs font-semibold uppercase text-red-700">Cancelled: this payment was reversed</div>}
      <LetterheadBlock lh={lh} />
      <h1 className="mb-4 text-center text-lg font-bold uppercase underline">Receipt</h1>
      <div className="mb-4 flex justify-between text-xs">
        <span>Receipt No. {payment.receiptNumber}</span>
        <span>Date: {fmtDate(payment.paidAt)}</span>
      </div>
      <p className="leading-loose">
        Received with thanks from <b>{from || 'a member'}</b> the sum of <b>{inWords(Number(payment.amount))}</b> by <b>{payment.paymentMode}</b>
        {payment.reference ? ` (ref. ${payment.reference})` : ''} towards the <b>{fund.name}</b> fund.
      </p>
      <div className="mt-6 inline-block border-2 border-slate-800 px-4 py-2 text-lg font-bold tabular-nums">{rupees(payment.amount)}</div>
      {payment.paymentMode === 'CHEQUE' && <p className="mt-3 text-[11px]">Subject to realisation of the cheque.</p>}
      <Signatures names={['Received by', `For ${lh?.name || 'the society'}\nHon. Treasurer`]} />
      <p className="mt-6 text-center text-[10px] text-slate-500">This receipt was generated by the society&apos;s management system.</p>
    </PrintSheet>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <tr>
      <td className="border border-slate-400 p-2">{label}</td>
      <td className={`border border-slate-400 p-2 text-right tabular-nums ${bold ? 'font-bold' : ''}`}>{value}</td>
    </tr>
  );
}
