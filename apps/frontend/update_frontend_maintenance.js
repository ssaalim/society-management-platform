const fs = require('fs');
const file = '/Users/salimshaikh/Documents/societyApp/apps/frontend/src/app/[society_slug]/maintenance/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add import for useSearchParams
if (!content.includes('useSearchParams')) {
  content = content.replace(/import \{ useRouter \} from 'next\/navigation';/, `import { useRouter, useSearchParams } from 'next/navigation';`);
}

// Add state and extraction
const stateStr = `  const searchParams = useSearchParams();\n  const [showMyInvoices, setShowMyInvoices] = useState<boolean>(searchParams.get('mine') === 'true');\n`;
if (!content.includes('const [showMyInvoices, setShowMyInvoices]')) {
  content = content.replace(/const \[billsList, setBillsList\] = useState<BillListItem\[\]>\(\[\]\);/, `const [billsList, setBillsList] = useState<BillListItem[]>([]);\n${stateStr}`);
}

// Update fetchBills
const fetchReplacement = `
      const urlParams = new URLSearchParams();
      if (searchTerm) urlParams.append('search', searchTerm);
      if (statusFilter) urlParams.append('status', statusFilter);
      if (showMyInvoices) urlParams.append('mine', 'true');
`;
content = content.replace(/const urlParams = new URLSearchParams\(\);\n\s*if \(searchTerm\) urlParams\.append\('search', searchTerm\);\n\s*if \(statusFilter\) urlParams\.append\('status', statusFilter\);/, fetchReplacement.trim());

// Update fetchBills dependencies
content = content.replace(/\[society_slug, searchTerm, statusFilter, activeSociety\?\.societyId\]/, `[society_slug, searchTerm, statusFilter, showMyInvoices, activeSociety?.societyId]`);

// Add toggle button to UI
const uiReplacement = `
          {/* My Invoices Toggle */}
          <div className="flex items-center gap-2">
            <label className="flex items-center cursor-pointer">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={showMyInvoices} 
                  onChange={(e) => setShowMyInvoices(e.target.checked)} 
                />
                <div className={\`block w-10 h-6 rounded-full transition-colors \${showMyInvoices ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}\`}></div>
                <div className={\`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform \${showMyInvoices ? 'translate-x-4' : ''}\`}></div>
              </div>
              <div className="ml-3 text-xs font-semibold text-slate-700 dark:text-slate-300">My Flats Only</div>
            </label>
          </div>

          <div className="flex flex-1 sm:flex-none items-center gap-2">
`;
content = content.replace(/<div className="flex flex-1 sm:flex-none items-center gap-2">/, uiReplacement.trim());

fs.writeFileSync(file, content);
