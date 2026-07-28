const fs = require('fs');
const file = '/Users/salimshaikh/Documents/societyApp/apps/frontend/src/app/[society_slug]/payments/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Update ReceiptItem interface to include new fields
const interfaceReplacer = `
interface ReceiptItem {
  id: string;
  receiptNumber: string;
  amountPaid: string | number;
  paymentMode: string;
  paymentDate: string;
  referenceNumber: string | null;
  status: 'CLEARED' | 'BOUNCED' | 'REFUNDED' | 'CANCELLED' | 'REVIEW' | 'REJECTED';
  refundedAmount: string | number | null;
  cancellationReason: string | null;
  billNumber: string;
  flatNumber: string;
  userRemark?: string | null;
  rejectionReason?: string | null;
  approvedBy?: string | null;
}
`;
content = content.replace(/interface ReceiptItem \{[\s\S]*?\}/, interfaceReplacer.trim());

// Update modalAction type to include 'approve'
content = content.replace(/const \[modalAction, setModalAction\] = useState<'refund' \| 'cancel' \| null>\(null\);/, "const [modalAction, setModalAction] = useState<'refund' | 'cancel' | 'approve' | 'reject' | null>(null);");

// Update handlePostAction
const postActionReplacer = `
  const handlePostAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionReceiptId || !modalAction) return;
    if ((modalAction === 'cancel' || modalAction === 'reject') && !formReason) return;
    if (modalAction === 'refund' && formAmount <= 0) return;

    setIsProcessing(true);
    setMessage(null);

    try {
      let endpoint = '';
      let payload: any = {};

      if (modalAction === 'refund') {
        endpoint = \`/payments/receipts/\${actionReceiptId}/refund\`;
        payload = { amount: Number(formAmount), reason: formReason };
      } else if (modalAction === 'cancel') {
        endpoint = \`/payments/receipts/\${actionReceiptId}/cancel\`;
        payload = { reason: formReason };
      } else if (modalAction === 'approve') {
        endpoint = \`/maintenance/receipt/\${actionReceiptId}/approve\`;
      } else if (modalAction === 'reject') {
        endpoint = \`/maintenance/receipt/\${actionReceiptId}/reject\`;
        payload = { reason: formReason };
      }

      const res = await apiClient.post(endpoint, payload);
      if (res.data?.success) {
        setMessage({ type: 'success', text: \`Receipt \${modalAction} processed successfully!\` });
        setModalAction(null);
        fetchReceipts();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || \`Failed to \${modalAction} receipt.\` });
    } finally {
      setIsProcessing(false);
    }
  };
`;
content = content.replace(/const handlePostAction = async \(e: React\.FormEvent\) => \{[\s\S]*?finally \{\n\s*setIsProcessing\(false\);\n\s*\}\n\s*\};/, postActionReplacer.trim());

// Update row actions
const actionsReplacer = `
                    <td className="p-4 text-right space-x-2">
                      {isManagementRole && rec.status === 'REVIEW' && (
                        <>
                          <button
                            onClick={() => handleOpenActionModal(rec.id, 'approve', Number(rec.amountPaid))}
                            className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 px-2 py-1 rounded"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleOpenActionModal(rec.id, 'reject', Number(rec.amountPaid))}
                            className="text-[11px] font-bold text-red-400 hover:text-red-300 bg-red-950/40 px-2 py-1 rounded"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {isManagementRole && rec.status === 'CLEARED' && (
                        <>
                          <button
                            onClick={() => handleOpenActionModal(rec.id, 'refund', Number(rec.amountPaid))}
                            className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-all"
                          >
                            Refund
                          </button>
                          <button
                            onClick={() => handleOpenActionModal(rec.id, 'cancel', Number(rec.amountPaid))}
                            className="text-xs font-semibold text-red-400 hover:text-red-300 transition-all"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </td>
`;
content = content.replace(/<td className="p-4 text-right space-x-2">[\s\S]*?<\/td>/, actionsReplacer.trim());

// Update status badges and add remarks
const statusReplacer = `
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className={\`text-[10px] font-semibold border rounded-full px-2.5 py-1 uppercase tracking-wider w-max \${
                          rec.status === 'CLEARED'
                            ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400'
                            : rec.status === 'REFUNDED'
                            ? 'bg-amber-950/30 border-amber-900/50 text-amber-400'
                            : rec.status === 'REVIEW'
                            ? 'bg-blue-950/30 border-blue-900/50 text-blue-400'
                            : rec.status === 'REJECTED'
                            ? 'bg-red-950/30 border-red-900/50 text-red-500'
                            : 'bg-red-950/30 border-red-900/50 text-red-400'
                        }\`}>
                          {rec.status}
                        </span>
                        {rec.userRemark && (
                          <div className="text-[10px] text-slate-400 mt-1 max-w-[150px] truncate" title={rec.userRemark}>
                            <span className="font-bold">Note:</span> {rec.userRemark}
                          </div>
                        )}
                        {rec.rejectionReason && (
                          <div className="text-[10px] text-red-400 max-w-[150px] truncate" title={rec.rejectionReason}>
                            <span className="font-bold">Reject:</span> {rec.rejectionReason}
                          </div>
                        )}
                      </div>
                    </td>
`;
content = content.replace(/<td className="p-4">\s*<span className={`text-\[10px\] font-semibold border rounded-full px-2\.5 py-1 uppercase tracking-wider[\s\S]*?<\/span>\s*<\/td>/, statusReplacer.trim());

// Fix Modal action fields logic to support approve/reject
const modalBodyReplacer = `
              <div className="p-6 overflow-y-auto">
                <form id="payment-action-form" onSubmit={handlePostAction} className="space-y-4">
                {modalAction === 'refund' && (
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Refund Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formAmount}
                      onChange={(e) => setFormAmount(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-3 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                      max={receiptsList.find(r => r.id === actionReceiptId)?.amountPaid || 0}
                      required
                    />
                  </div>
                )}
                {(modalAction === 'cancel' || modalAction === 'refund' || modalAction === 'reject') && (
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium capitalize">{modalAction} Reason</label>
                    <textarea
                      rows={3}
                      value={formReason}
                      onChange={(e) => setFormReason(e.target.value)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-3 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                      required
                    />
                  </div>
                )}
                {modalAction === 'approve' && (
                  <p className="text-sm text-slate-300">Are you sure you want to approve this payment? The ledger will be updated.</p>
                )}
                </form>
              </div>
`;
content = content.replace(/<div className="p-6 overflow-y-auto">\s*<form id="payment-action-form" onSubmit=\{handlePostAction\} className="space-y-4">[\s\S]*?<\/form>\s*<\/div>/, modalBodyReplacer.trim());

fs.writeFileSync(file, content);
