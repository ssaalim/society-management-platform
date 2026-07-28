const fs = require('fs');
const file = '/Users/salimshaikh/Documents/societyApp/apps/frontend/src/components/layout/navbar.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Menu icon import
content = content.replace(/Bot,/, 'Bot,\n  Menu,');

// 2. Add state for mobile menu
content = content.replace(/const \[isSweeping, setIsSweeping\] = useState<boolean>\(false\);/, 
  'const [isSweeping, setIsSweeping] = useState<boolean>(false);\n  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);');

// 3. Make header tag responsive to light/dark
content = content.replace(/<header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950\/80 backdrop-blur-xl">/, 
  '<header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl transition-colors">');

// 4. Update brand colors for light mode
content = content.replace(/text-slate-100 hover:text-indigo-400/, 'text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400');

// 5. Update Theme Toggle colors
content = content.replace(/border-slate-800 bg-slate-900\/60 hover:bg-slate-800 text-amber-400/g, 
  'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-amber-500 dark:text-amber-400');

// 6. Update Notification Bell colors
content = content.replace(/border-slate-800 bg-slate-900\/60 hover:bg-slate-800 text-slate-300/g, 
  'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300');

// 7. Update Notification Popover colors
content = content.replace(/border-slate-800 bg-slate-900 shadow-2xl/g, 
  'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl');
content = content.replace(/text-slate-200/g, 'text-slate-900 dark:text-slate-200');
content = content.replace(/border-slate-800/g, 'border-slate-200 dark:border-slate-800');

// 8. Update Sign Out button colors
content = content.replace(/border-slate-800 bg-slate-900\/60 p-2 text-slate-500 dark:text-slate-400 hover:text-slate-200 hover:bg-slate-800/g, 
  'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800');

// 9. Update the Navigation Menu Bar rendering with Hamburger
const navRegex = /{\/\* Navigation Menu Bar \*\/}[\s\S]*?{societySlug && \([\s\S]*?<div className="border-t border-slate-800\/60 bg-slate-950\/40">[\s\S]*?<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto py-2 sm:py-1 scrollbar-none">([\s\S]*?)<\/div>\s*<\/div>\s*\)\s*}/;

const mobileNavReplacement = `{/* Navigation Menu Bar */}
      {societySlug && (
        <div className="border-t border-slate-200 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/40">
          
          {/* Mobile Menu Toggle */}
          <div className="sm:hidden px-4 py-2.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/60">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Navigation Menu</span>
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>

          {/* Nav Items (Vertical on Mobile, Horizontal on Desktop) */}
          <div className={\`\${isMobileMenuOpen ? 'flex' : 'hidden'} sm:flex flex-col sm:flex-row sm:items-center sm:flex-wrap sm:gap-1 max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-2 sm:py-1\`}>$1</div>
        </div>
      )}`;

content = content.replace(navRegex, mobileNavReplacement);

// 10. Update Active/Inactive Nav Item styles to work well on mobile and support light theme
content = content.replace(/isActive\s*\?\s*'bg-indigo-600\/20 text-indigo-300 border border-indigo-500\/30'\s*:\s*'text-slate-500 dark:text-slate-400 hover:text-slate-200 hover:bg-slate-900\/60'/g, 
  `isActive
                      ? 'bg-indigo-50 dark:bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/60 border border-transparent'`);

// 11. Adjust link padding so they look like big buttons on mobile
content = content.replace(/className={\`flex items-center gap-2 px-3 py-2\.5 sm:py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap \${/g, 
  'className={`flex items-center gap-3 sm:gap-2 px-4 sm:px-3 py-3 sm:py-2 rounded-lg text-sm sm:text-xs font-medium transition-all w-full sm:w-auto ${');

fs.writeFileSync(file, content);
