const fs = require('fs');

const file = '/Users/salimshaikh/Documents/societyApp/apps/frontend/src/app/[society_slug]/dashboard/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace StatCard Component
content = content.replace(/interface StatCardProps \{[\s\S]*?function StatCard[^\}]+\}[\s\S]*?return \([\s\S]*?\}\);?\n\}/, `interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  accent?: string;
  colorTheme?: 'emerald' | 'sky' | 'amber' | 'violet' | 'indigo' | 'red' | 'teal' | 'cyan' | 'slate';
}

function StatCard({ label, value, icon, trend, trendLabel, accent, colorTheme = 'slate' }: StatCardProps) {
  const themeClasses: Record<string, { bg: string, text: string, border: string, iconBg: string, label: string }> = {
    emerald: { bg: 'bg-emerald-50 hover:bg-emerald-100 dark:bg-slate-950/30 dark:hover:bg-slate-950/50', border: 'border-emerald-200 dark:border-emerald-900/30', text: 'text-emerald-950 dark:text-slate-100', label: 'text-emerald-700 dark:text-slate-400', iconBg: 'bg-emerald-100 dark:bg-slate-900/60 border-emerald-200 dark:border-slate-800/40' },
    sky: { bg: 'bg-sky-50 hover:bg-sky-100 dark:bg-slate-950/30 dark:hover:bg-slate-950/50', border: 'border-sky-200 dark:border-sky-900/30', text: 'text-sky-950 dark:text-slate-100', label: 'text-sky-700 dark:text-slate-400', iconBg: 'bg-sky-100 dark:bg-slate-900/60 border-sky-200 dark:border-slate-800/40' },
    amber: { bg: 'bg-amber-50 hover:bg-amber-100 dark:bg-slate-950/30 dark:hover:bg-slate-950/50', border: 'border-amber-200 dark:border-amber-900/30', text: 'text-amber-950 dark:text-slate-100', label: 'text-amber-700 dark:text-slate-400', iconBg: 'bg-amber-100 dark:bg-slate-900/60 border-amber-200 dark:border-slate-800/40' },
    violet: { bg: 'bg-violet-50 hover:bg-violet-100 dark:bg-slate-950/30 dark:hover:bg-slate-950/50', border: 'border-violet-200 dark:border-violet-900/30', text: 'text-violet-950 dark:text-slate-100', label: 'text-violet-700 dark:text-slate-400', iconBg: 'bg-violet-100 dark:bg-slate-900/60 border-violet-200 dark:border-slate-800/40' },
    indigo: { bg: 'bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-950/30 dark:hover:bg-slate-950/50', border: 'border-indigo-200 dark:border-indigo-900/30', text: 'text-indigo-950 dark:text-slate-100', label: 'text-indigo-700 dark:text-slate-400', iconBg: 'bg-indigo-100 dark:bg-slate-900/60 border-indigo-200 dark:border-slate-800/40' },
    red: { bg: 'bg-red-50 hover:bg-red-100 dark:bg-slate-950/30 dark:hover:bg-slate-950/50', border: 'border-red-200 dark:border-red-900/30', text: 'text-red-950 dark:text-slate-100', label: 'text-red-700 dark:text-slate-400', iconBg: 'bg-red-100 dark:bg-slate-900/60 border-red-200 dark:border-slate-800/40' },
    cyan: { bg: 'bg-cyan-50 hover:bg-cyan-100 dark:bg-slate-950/30 dark:hover:bg-slate-950/50', border: 'border-cyan-200 dark:border-cyan-900/30', text: 'text-cyan-950 dark:text-slate-100', label: 'text-cyan-700 dark:text-slate-400', iconBg: 'bg-cyan-100 dark:bg-slate-900/60 border-cyan-200 dark:border-slate-800/40' },
    slate: { bg: 'bg-white hover:bg-slate-50 dark:bg-slate-950/30 dark:hover:bg-slate-950/50', border: 'border-slate-200 dark:border-slate-800', text: 'text-slate-900 dark:text-slate-100', label: 'text-slate-500 dark:text-slate-400', iconBg: 'bg-slate-100 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/40' },
  };

  const t = themeClasses[colorTheme] || themeClasses.slate;
  const resolvedBorder = accent || t.border;

  return (
    <div className={\`rounded-xl border \${resolvedBorder} \${t.bg} shadow-md dark:shadow-none p-5 space-y-3 transition-all hover:shadow-lg\`}>
      <div className="flex items-center justify-between">
        <span className={\`text-[11px] font-bold uppercase tracking-wider \${t.label}\`}>{label}</span>
        <div className={\`flex h-8 w-8 items-center justify-center rounded-lg border \${t.iconBg}\`}>
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={\`text-2xl font-black \${t.text}\`}>{value}</span>
        {trend && trendLabel && (
          <span className={\`text-[10px] font-semibold flex items-center gap-0.5 \${
            trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : trend === 'down' ? 'text-red-600 dark:text-red-400' : 'text-slate-500'
          }\`}>
            {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : trend === 'down' ? <TrendingDown className="h-3 w-3" /> : null}
            {trendLabel}
          </span>
        )}
      </div>
    </div>
  );
}`);

// Replace QuickAction Component
content = content.replace(/interface QuickActionProps \{[\s\S]*?function QuickAction[^\}]+\}[\s\S]*?return \([\s\S]*?\}\);?\n\}/, `interface QuickActionProps {
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  accent?: string;
  colorTheme?: 'emerald' | 'sky' | 'amber' | 'violet' | 'indigo' | 'red' | 'teal' | 'cyan' | 'slate';
}

function QuickAction({ label, description, href, icon, accent, colorTheme = 'slate' }: QuickActionProps) {
  const themeClasses: Record<string, { bg: string, text: string, desc: string, border: string, iconBg: string }> = {
    emerald: { bg: 'bg-emerald-50 hover:bg-emerald-100 dark:bg-slate-950/40 dark:hover:bg-slate-950/60', border: 'border-emerald-200 dark:border-emerald-900/30', text: 'text-emerald-950 dark:text-slate-200', desc: 'text-emerald-700 dark:text-slate-400', iconBg: 'bg-emerald-100 dark:bg-slate-900/80 border-emerald-200 dark:border-slate-800/60' },
    sky: { bg: 'bg-sky-50 hover:bg-sky-100 dark:bg-slate-950/40 dark:hover:bg-slate-950/60', border: 'border-sky-200 dark:border-sky-900/30', text: 'text-sky-950 dark:text-slate-200', desc: 'text-sky-700 dark:text-slate-400', iconBg: 'bg-sky-100 dark:bg-slate-900/80 border-sky-200 dark:border-slate-800/60' },
    amber: { bg: 'bg-amber-50 hover:bg-amber-100 dark:bg-slate-950/40 dark:hover:bg-slate-950/60', border: 'border-amber-200 dark:border-amber-900/30', text: 'text-amber-950 dark:text-slate-200', desc: 'text-amber-700 dark:text-slate-400', iconBg: 'bg-amber-100 dark:bg-slate-900/80 border-amber-200 dark:border-slate-800/60' },
    violet: { bg: 'bg-violet-50 hover:bg-violet-100 dark:bg-slate-950/40 dark:hover:bg-slate-950/60', border: 'border-violet-200 dark:border-violet-900/30', text: 'text-violet-950 dark:text-slate-200', desc: 'text-violet-700 dark:text-slate-400', iconBg: 'bg-violet-100 dark:bg-slate-900/80 border-violet-200 dark:border-slate-800/60' },
    indigo: { bg: 'bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-950/40 dark:hover:bg-slate-950/60', border: 'border-indigo-200 dark:border-indigo-900/30', text: 'text-indigo-950 dark:text-slate-200', desc: 'text-indigo-700 dark:text-slate-400', iconBg: 'bg-indigo-100 dark:bg-slate-900/80 border-indigo-200 dark:border-slate-800/60' },
    slate: { bg: 'bg-white hover:bg-slate-50 dark:bg-slate-950/40 dark:hover:bg-slate-950/60', border: 'border-slate-200 dark:border-slate-800', text: 'text-slate-900 dark:text-slate-200', desc: 'text-slate-500 dark:text-slate-400', iconBg: 'bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800/60' },
  };

  const t = themeClasses[colorTheme] || themeClasses.slate;
  const resolvedBorder = accent || t.border;

  return (
    <Link
      href={href}
      className={\`group flex items-center gap-4 rounded-xl border \${resolvedBorder} \${t.bg} p-4 transition-all hover:scale-[1.02] shadow-sm hover:shadow-md dark:shadow-none dark:hover:shadow-lg quick-action-tile\`}
    >
      <div className={\`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border \${t.iconBg} quick-action-icon\`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className={\`text-sm font-semibold transition-colors quick-action-title \${t.text} group-hover:text-indigo-600 dark:group-hover:text-indigo-400\`}>{label}</h4>
        <p className={\`text-[11px] truncate quick-action-desc \${t.desc}\`}>{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors shrink-0" />
    </Link>
  );
}`);


// Fix all StatCard calls
content = content.replace(/accent="border-emerald-[^\"]+"/g, 'colorTheme="emerald"');
content = content.replace(/accent="border-sky-[^\"]+"/g, 'colorTheme="sky"');
content = content.replace(/accent="border-amber-[^\"]+"/g, 'colorTheme="amber"');
content = content.replace(/accent="border-violet-[^\"]+"/g, 'colorTheme="violet"');
content = content.replace(/accent="border-indigo-[^\"]+"/g, 'colorTheme="indigo"');
content = content.replace(/accent="border-red-[^\"]+"/g, 'colorTheme="red"');
content = content.replace(/accent="border-cyan-[^\"]+"/g, 'colorTheme="cyan"');

// Fix text-color mapping so dark variant isn't strictly necessary manually, but let's just make it robust
// The actual icons in the usage have things like <IndianRupee className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />.
// That is perfectly fine and keeps the icons visible. We don't need to strip them.

// Update Header Roles config
content = content.replace(/from-red-500\/20 to-red-600\/5 border-red-500\/20/g, 'from-red-50 to-white border-red-200 dark:from-red-500/20 dark:to-red-600/5 dark:border-red-500/20');
content = content.replace(/from-amber-500\/20 to-orange-600\/5 border-amber-500\/20/g, 'from-amber-50 to-white border-amber-200 dark:from-amber-500/20 dark:to-orange-600/5 dark:border-amber-500/20');
content = content.replace(/from-amber-500\/20 to-amber-600\/5 border-amber-500\/20/g, 'from-amber-50 to-white border-amber-200 dark:from-amber-500/20 dark:to-amber-600/5 dark:border-amber-500/20');
content = content.replace(/from-violet-500\/20 to-violet-600\/5 border-violet-500\/20/g, 'from-violet-50 to-white border-violet-200 dark:from-violet-500/20 dark:to-violet-600/5 dark:border-violet-500/20');
content = content.replace(/from-emerald-500\/20 to-emerald-600\/5 border-emerald-500\/20/g, 'from-emerald-50 to-white border-emerald-200 dark:from-emerald-500/20 dark:to-emerald-600/5 dark:border-emerald-500/20');
content = content.replace(/from-cyan-500\/20 to-cyan-600\/5 border-cyan-500\/20/g, 'from-cyan-50 to-white border-cyan-200 dark:from-cyan-500/20 dark:to-cyan-600/5 dark:border-cyan-500/20');
content = content.replace(/from-sky-500\/20 to-sky-600\/5 border-sky-500\/20/g, 'from-sky-50 to-white border-sky-200 dark:from-sky-500/20 dark:to-sky-600/5 dark:border-sky-500/20');
content = content.replace(/from-teal-500\/20 to-teal-600\/5 border-teal-500\/20/g, 'from-teal-50 to-white border-teal-200 dark:from-teal-500/20 dark:to-teal-600/5 dark:border-teal-500/20');

fs.writeFileSync(file, content);
