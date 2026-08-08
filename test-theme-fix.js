const fs = require('fs');

const path = 'apps/frontend/src/app/[society_slug]/dashboard/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace bg-slate-X
content = content.replace(/bg-slate-950/g, 'bg-white dark:bg-slate-950');
content = content.replace(/bg-slate-900/g, 'bg-slate-50 dark:bg-slate-900');
content = content.replace(/bg-slate-800/g, 'bg-slate-100 dark:bg-slate-800');

// Replace text-slate-X
content = content.replace(/text-slate-200/g, 'text-slate-900 dark:text-slate-200');
content = content.replace(/text-slate-300/g, 'text-slate-800 dark:text-slate-300');
content = content.replace(/text-slate-400/g, 'text-slate-700 dark:text-slate-400');
content = content.replace(/text-slate-500/g, 'text-slate-500 dark:text-slate-500');

// Replace border-slate-X
content = content.replace(/border-slate-800/g, 'border-slate-200 dark:border-slate-800');
content = content.replace(/border-slate-700/g, 'border-slate-300 dark:border-slate-700');

fs.writeFileSync('scratch-test.tsx', content);
console.log('Done');
