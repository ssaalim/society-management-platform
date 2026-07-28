const fs = require('fs');
const file = '/Users/salimshaikh/Documents/societyApp/apps/frontend/src/app/[society_slug]/maintenance/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add BankAccounts interface and state
content = content.replace(/export default function MaintenanceDashboardPage\(\) \{/, `
interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  isDefault: boolean;
}

export default function MaintenanceDashboardPage() {
`);

content = content.replace(/const \[statusFilter, setStatusFilter\] = useState<string>\(''\);/, `const [statusFilter, setStatusFilter] = useState<string>('');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [depositAccountId, setDepositAccountId] = useState<string>('');
  const [bulkDepositAccountId, setBulkDepositAccountId] = useState<string>('');
`);

// 2. Fetch Bank Accounts
content = content.replace(/const fetchBills = async \(\) => \{/, `const fetchBankAccounts = async () => {
    if (!activeSociety?.id) return;
    try {
      const res = await apiClient.get(\`/society/\${activeSociety.id}/bank-accounts\`);
      if (res.data?.success) {
        setBankAccounts(res.data.data);
        const defaultAcc = res.data.data.find((a: any) => a.isDefault);
        if (defaultAcc) {
          setDepositAccountId(defaultAcc.id);
          setBulkDepositAccountId(defaultAcc.id);
        } else if (res.data.data.length > 0) {
          setDepositAccountId(res.data.data[0].id);
          setBulkDepositAccountId(res.data.data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load bank accounts:', err);
    }
  };

  const fetchBills = async () => {`);

// 3. Add fetchBankAccounts to useEffect
content = content.replace(/fetchBills\(\);\n  \}, \[society_slug, searchTerm, statusFilter\]\);/, `fetchBills();\n    fetchBankAccounts();\n  }, [society_slug, searchTerm, statusFilter, activeSociety?.id]);`);

// 4. Update payloads
content = content.replace(/paymentMode,\n        transactionId: transactionRef \|\| null,\n        paymentDate,/, `paymentMode,
        transactionId: transactionRef || null,
        depositAccountId: paymentMode !== 'CASH' && depositAccountId ? depositAccountId : null,
        paymentDate,`);

content = content.replace(/paymentMode: bulkPaymentMode,\n        transactionId: bulkTransactionRef \|\| null,\n        paymentDate: bulkPaymentDate,/, `paymentMode: bulkPaymentMode,
        transactionId: bulkTransactionRef || null,
        depositAccountId: bulkPaymentMode !== 'CASH' && bulkDepositAccountId ? bulkDepositAccountId : null,
        paymentDate: bulkPaymentDate,`);

// 5. Add Deposit Bank Account Dropdown to single payment form
const singleDropdown = `
                  {paymentMode !== 'CASH' && bankAccounts.length > 0 && (
                    <div>
                      <label className="text-xs text-slate-600 dark:text-slate-400 font-medium">Deposit Bank Account</label>
                      <select
                        value={depositAccountId}
                        onChange={(e) => setDepositAccountId(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-900 dark:text-slate-300 focus:border-slate-700 focus:outline-none appearance-none mt-1"
                      >
                        {bankAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.bankName} - {acc.accountNumber} {acc.isDefault ? '(Default)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      Reference / Transaction Details`;

content = content.replace(/<div>\s*<label className="text-xs text-slate-600 dark:text-slate-400 font-medium">\s*Reference \/ Transaction Details/, singleDropdown);

// 6. Add Deposit Bank Account Dropdown to bulk payment form
const bulkDropdown = `
                    {bulkPaymentMode !== 'CASH' && bankAccounts.length > 0 && (
                      <div>
                        <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Deposit Bank Account</label>
                        <select
                          value={bulkDepositAccountId}
                          onChange={(e) => setBulkDepositAccountId(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-900 dark:text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                        >
                          {bankAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.bankName} - {acc.accountNumber} {acc.isDefault ? '(Default)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Reference / Transaction ID`;

content = content.replace(/<div>\s*<label className="text-xs text-slate-500 dark:text-slate-400 font-medium">\s*Reference \/ Transaction ID/, bulkDropdown);

fs.writeFileSync(file, content);
