const fs = require('fs');
const file = '/Users/salimshaikh/Documents/societyApp/apps/frontend/src/app/[society_slug]/maintenance/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add generationType state
content = content.replace(/const \[dueDate, setDueDate\] = useState<string>\(''\);/, `const [dueDate, setDueDate] = useState<string>('');
  const [generationType, setGenerationType] = useState<'SINGLE' | 'PER_MONTH'>('SINGLE');`);

// Update API payload
content = content.replace(/periodStart,\n\s*periodEnd,\n\s*dueDate,/, `periodStart,
        periodEnd,
        dueDate,
        generationType,`);

// Add Radio buttons in UI
const radioButtons = `
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 font-medium">Generation Type</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input 
                      type="radio" 
                      name="generationType" 
                      value="SINGLE" 
                      checked={generationType === 'SINGLE'} 
                      onChange={() => setGenerationType('SINGLE')}
                      className="accent-indigo-500"
                    />
                    <span>Single Combined Invoice</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input 
                      type="radio" 
                      name="generationType" 
                      value="PER_MONTH" 
                      checked={generationType === 'PER_MONTH'} 
                      onChange={() => setGenerationType('PER_MONTH')}
                      className="accent-indigo-500"
                    />
                    <span>Separate Invoice per Month</span>
                  </label>
                </div>
              </div>
              <button
`;

content = content.replace(/<button\n\s*type="submit"\n\s*disabled=\{isProcessing\}/, radioButtons.trim() + '\n              <button\n                type="submit"\n                disabled={isProcessing}');

fs.writeFileSync(file, content);
