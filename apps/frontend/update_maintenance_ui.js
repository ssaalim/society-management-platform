const fs = require('fs');
const file = '/Users/salimshaikh/Documents/societyApp/apps/frontend/src/app/[society_slug]/maintenance/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add userRemark state
if (!content.includes('const [userRemark, setUserRemark]')) {
  content = content.replace(/const \[paymentDate, setPaymentDate\] = useState<string>\(new Date\(\)\.toISOString\(\)\.substring\(0, 10\)\);/, 
    "const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().substring(0, 10));\n  const [userRemark, setUserRemark] = useState<string>('');"
  );
}

// Reset userRemark in handleOpenSinglePaymentModal
content = content.replace(/setPaymentDate\(new Date\(\)\.toISOString\(\)\.substring\(0, 10\)\);/g, "setPaymentDate(new Date().toISOString().substring(0, 10));\n    setUserRemark('');");

// Include userRemark in handleSinglePaymentSubmit payload
content = content.replace(/depositAccountId: paymentMode !== 'CASH' && depositAccountId \? depositAccountId : null,\n\s*paymentDate,/g, "depositAccountId: paymentMode !== 'CASH' && depositAccountId ? depositAccountId : null,\n        paymentDate,\n        userRemark,");

// Include userRemark in handleBulkPaymentSubmit payload (though maybe not needed for bulk since residents might not do bulk, but let's add it)
if (!content.includes('const [bulkUserRemark, setBulkUserRemark]')) {
  content = content.replace(/const \[bulkPaymentDate, setBulkPaymentDate\] = useState<string>\(new Date\(\)\.toISOString\(\)\.substring\(0, 10\)\);/, 
    "const [bulkPaymentDate, setBulkPaymentDate] = useState<string>(new Date().toISOString().substring(0, 10));\n  const [bulkUserRemark, setBulkUserRemark] = useState<string>('');"
  );
}
content = content.replace(/setBulkPaymentDate\(new Date\(\)\.toISOString\(\)\.substring\(0, 10\)\);/g, "setBulkPaymentDate(new Date().toISOString().substring(0, 10));\n    setBulkUserRemark('');");
content = content.replace(/depositAccountId: bulkPaymentMode !== 'CASH' && bulkDepositAccountId \? bulkDepositAccountId : null,\n\s*paymentDate: bulkPaymentDate,/g, "depositAccountId: bulkPaymentMode !== 'CASH' && bulkDepositAccountId ? bulkDepositAccountId : null,\n        paymentDate: bulkPaymentDate,\n        userRemark: bulkUserRemark,");

// Update success message based on whether the user is a resident or management
// The backend returns a status of REVIEW if resident. But we can just use a generic message.
content = content.replace(
  /setMessage\(\{\n\s*type: 'success',\n\s*text: `Payment receipt confirmed cleanly! \$\{[\s\S]*?\}`,\n\s*\}\);/,
  `setMessage({
          type: 'success',
          text: 'Payment receipt submitted successfully! If you are a resident, it is pending review.',
        });`
);

// Add input field to UI single payment modal
const uiInput = `
                      <div>
                        <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Payment Date</label>
                        <input
                          type="date"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                          className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-3 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Remark / Notes (Optional)</label>
                        <textarea
                          rows={2}
                          value={userRemark}
                          onChange={(e) => setUserRemark(e.target.value)}
                          placeholder="E.g. Resubmitting after rejection..."
                          className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-3 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                        ></textarea>
                      </div>
`;
content = content.replace(/<div>\s*<label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Payment Date<\/label>\s*<input\s*type="date"\s*value=\{paymentDate\}[\s\S]*?<\/div>/, uiInput.trim());

fs.writeFileSync(file, content);
