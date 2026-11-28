'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { LetterheadBlock, PrintSheet, Signatures, useLetterhead } from '@/components/print/print-sheet';
import type { MeetingDetailData } from './meeting-detail';

const longDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' });
const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }) : '');
const clean = (n: string) => n.replace(/\s*\(.*\)$/, '');

/** The meeting notice, as sent to members: date, time, place and the agenda. */
export function NoticeDocument({ m, onClose }: { m: MeetingDetailData; onClose: () => void }) {
  const lh = useLetterhead();
  const audience = m.audience === 'COMMITTEE' ? 'the Managing Committee' : 'the members';
  return (
    <PrintSheet title={`Notice - ${m.title}`} onClose={onClose}>
      <LetterheadBlock lh={lh} />
      <div className="mb-4 flex justify-between text-xs">
        <span>Ref: NOTICE/{m.type}/{new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(m.noticeSentAt || m.scheduledAt))}</span>
        <span>Date: {shortDate(m.noticeSentAt) || shortDate(new Date().toISOString())}</span>
      </div>
      <h1 className="mb-4 text-center text-lg font-bold uppercase underline">Notice of {m.typeLabel}</h1>
      <p>
        Notice is hereby given that the <b>{m.typeLabel}</b> of {audience} of <b>{lh?.name || 'the society'}</b> will be held on{' '}
        <b>{longDate(m.scheduledAt)}</b> at <b>{time(m.scheduledAt)}</b> at <b>{m.location}</b> to transact the following business:
      </p>
      <ol className="my-4 list-decimal space-y-1.5 pl-6">
        {m.agenda.map((a) => (
          <li key={a.id}>
            <span className="font-medium">{a.title}</span>
            {a.presenter && <span> (to be presented by {a.presenter})</span>}
            {a.description && <div className="whitespace-pre-line text-[12px]">{a.description}</div>}
          </li>
        ))}
        <li>Any other matter with the permission of the Chair.</li>
      </ol>
      {m.description && <p className="whitespace-pre-line">{m.description}</p>}
      <div className="mt-4 space-y-1 text-[12px]">
        <div className="font-semibold">Notes:</div>
        {m.quorumRequired ? (
          <p>
            1. The quorum for the meeting is {m.quorumRequired} members. If there is no quorum within half an hour of the appointed time, the meeting shall stand adjourned as per
            the bye-laws.
          </p>
        ) : null}
        {m.allowProxy && (
          <p>
            {m.quorumRequired ? 2 : 1}. A member who cannot attend may appoint a proxy in the app or by submitting a proxy form to the Secretary before the meeting. One person may
            represent at most {m.proxyLimit} member{m.proxyLimit === 1 ? '' : 's'}.
          </p>
        )}
        <p>Members are requested to attend on time and let the office know through the app whether they will attend.</p>
      </div>
      <div className="mt-12 text-right">
        <div>By order of the Managing Committee</div>
        <div className="mt-10 font-semibold">{m.signatories?.secretary ? clean(m.signatories.secretary) : '____________________'}</div>
        <div>Hon. Secretary</div>
      </div>
    </PrintSheet>
  );
}

interface PrintResolution {
  id: string;
  number: number;
  title: string;
  body: string | null;
  proposedBy: string | null;
  secondedBy: string | null;
  thresholdLabel: string;
  status: string;
  result: 'PASSED' | 'FAILED' | null;
  tally: { FOR: number; AGAINST: number; ABSTAIN: number } | null;
}

/** Minutes: who attended, what was discussed, resolutions with their results, and follow-ups. */
export function MinutesDocument({ m, onClose }: { m: MeetingDetailData; onClose: () => void }) {
  const lh = useLetterhead();
  const [resolutions, setResolutions] = useState<PrintResolution[] | null>(null);
  useEffect(() => {
    apiClient
      .get(`/meetings/${m.id}/resolutions`)
      .then((res) => setResolutions(res.data.data))
      .catch(() => setResolutions([]));
  }, [m.id]);
  const draft = m.minutes?.status !== 'FINAL';
  const attendees = m.attendees || [];
  return (
    <PrintSheet title={`Minutes - ${m.title}`} onClose={onClose}>
      {draft && <div className="mb-3 border border-amber-500 p-1 text-center text-xs font-semibold uppercase text-amber-700">Draft: not yet confirmed</div>}
      <LetterheadBlock lh={lh} />
      <h1 className="mb-1 text-center text-lg font-bold uppercase">Minutes of the {m.typeLabel}</h1>
      <p className="mb-4 text-center">
        held on {longDate(m.scheduledAt)} at {time(m.scheduledAt)}, {m.location}
      </p>

      <h2 className="mt-4 font-semibold">Present</h2>
      {attendees.length ? (
        <p>
          {attendees.map((a, i) => (
            <span key={i}>
              {clean(a.name)}
              {a.viaProxy ? ` (through proxy ${clean(a.viaProxy)})` : ''}
              {i < attendees.length - 1 ? '; ' : ''}
            </span>
          ))}
        </p>
      ) : (
        <p>
          {m.presentInPerson} member{m.presentInPerson === 1 ? '' : 's'} in person{m.allowProxy ? ` and ${m.presentByProxy} by proxy` : ''}.
        </p>
      )}
      {m.quorumRequired ? <p className="text-[12px]">Quorum ({m.quorumRequired}) {m.quorumMet ? 'was present' : 'was NOT present'}.</p> : null}

      <h2 className="mt-4 font-semibold">Proceedings</h2>
      <div className="whitespace-pre-line">{m.minutes?.content}</div>

      {resolutions && resolutions.filter((r) => r.status !== 'DRAFT').length > 0 && (
        <>
          <h2 className="mt-4 font-semibold">Resolutions</h2>
          {resolutions
            .filter((r) => r.status !== 'DRAFT')
            .map((r) => (
              <div key={r.id} className="mt-2 break-inside-avoid">
                <div className="font-medium">
                  Resolution No. {r.number}: {r.title}
                </div>
                {r.body && <p className="whitespace-pre-line italic">{r.body}</p>}
                <p className="text-[12px]">
                  {r.proposedBy && `Proposed by ${r.proposedBy}`}
                  {r.proposedBy && r.secondedBy && '; '}
                  {r.secondedBy && `seconded by ${r.secondedBy}`}
                  {(r.proposedBy || r.secondedBy) && '. '}
                  {r.status === 'CLOSED' && r.tally
                    ? `Votes: ${r.tally.FOR} for, ${r.tally.AGAINST} against, ${r.tally.ABSTAIN} abstained (${r.thresholdLabel} required). `
                    : 'Voting was still open when these minutes were printed. '}
                  {r.status === 'CLOSED' && <b>{r.result === 'PASSED' ? 'Carried.' : 'Not carried.'}</b>}
                </p>
              </div>
            ))}
        </>
      )}

      {m.actionItems.length > 0 && (
        <>
          <h2 className="mt-4 font-semibold">Action to be taken</h2>
          <table className="mt-1 w-full border-collapse text-[12px]">
            <thead>
              <tr>
                <th className="border border-slate-400 p-1 text-left">What</th>
                <th className="border border-slate-400 p-1 text-left">By</th>
                <th className="border border-slate-400 p-1 text-left">Due</th>
              </tr>
            </thead>
            <tbody>
              {m.actionItems.map((a) => (
                <tr key={a.id}>
                  <td className="border border-slate-400 p-1">{a.title}</td>
                  <td className="border border-slate-400 p-1">{a.ownerName ? clean(a.ownerName) : '—'}</td>
                  <td className="border border-slate-400 p-1">{a.dueDate ? shortDate(`${a.dueDate}T00:00:00+05:30`) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {m.minutes?.finalisedAt && <p className="mt-4 text-[12px]">Minutes confirmed on {shortDate(m.minutes.finalisedAt)}.</p>}
      <Signatures
        names={[
          `${m.signatories?.chairman ? clean(m.signatories.chairman) : ''}\nChairman`.trim(),
          `${m.signatories?.secretary ? clean(m.signatories.secretary) : ''}\nHon. Secretary`.trim(),
        ]}
      />
    </PrintSheet>
  );
}
