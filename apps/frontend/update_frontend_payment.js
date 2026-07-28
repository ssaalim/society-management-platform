const fs = require('fs');
const file = '/Users/salimshaikh/Documents/societyApp/apps/frontend/src/app/[society_slug]/payments/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add import for useSearchParams
if (!content.includes('useSearchParams')) {
  content = content.replace(/import \{ useRouter \} from 'next\/navigation';/, `import { useRouter, useSearchParams } from 'next/navigation';`);
}

// Add state
const stateStr = `  const searchParams = useSearchParams();\n  const [showMyPayments, setShowMyPayments] = useState<boolean>(searchParams.get('mine') === 'true');\n`;
if (!content.includes('const [showMyPayments, setShowMyPayments]')) {
  content = content.replace(/const \[receipts, setReceipts\] = useState<ReceiptListItem\[\]>\(\[\]\);/, `const [receipts, setReceipts] = useState<ReceiptListItem[]>([]);\n${stateStr}`);
}

// Update fetchReceipts
const fetchReplacement = `
      const urlParams = new URLSearchParams();
      if (searchTerm) urlParams.append('search', searchTerm);
      if (statusFilter) urlParams.append('status', statusFilter);
      if (showMyPayments) urlParams.append('mine', 'true');
`;
content = content.replace(/const urlParams = new URLSearchParams\(\);\n\s*if \(searchTerm\) urlParams\.append\('search', searchTerm\);\n\s*if \(statusFilter\) urlParams\.append\('status', statusFilter\);/, fetchReplacement.trim());

// Update fetchReceipts dependencies
content = content.replace(/\[society_slug, searchTerm, statusFilter\]/, `[society_slug, searchTerm, statusFilter, showMyPayments]`);

// Add toggle button to UI
const uiReplacement = `
          {/* My Payments Toggle */}
          <div className="flex items-center gap-2">
            <label className="flex items-center cursor-pointer">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={showMyPayments} 
                  onChange={(e) => setShowMyPayments(e.target.checked)} 
                />
                <div className={\`block w-10 h-6 rounded-full transition-colors \${showMyPayments ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}\`}></div>
                <div className={\`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform \${showMyPayments ? 'translate-x-4' : ''}\`}></div>
              </div>
              <div className="ml-3 text-xs font-semibold text-slate-700 dark:text-slate-300">My Flats Only</div>
            </label>
          </div>

          <div className="flex flex-1 sm:flex-none items-center gap-2">
`;
content = content.replace(/<div className="flex flex-1 sm:flex-none items-center gap-2">/, uiReplacement.trim());

fs.writeFileSync(file, content);
