const fs = require('fs');

const file = '/Users/salimshaikh/Documents/societyApp/apps/frontend/src/app/[society_slug]/dashboard/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Restore ROLE_CONFIG
content = content.replace(/from-red-50 to-white border-red-200 dark:from-red-500\/20 dark:to-red-600\/5 dark:border-red-500\/20/g, 'from-red-500/20 to-red-600/5 border-red-500/20');
content = content.replace(/from-amber-50 to-white border-amber-200 dark:from-amber-500\/20 dark:to-orange-600\/5 dark:border-amber-500\/20/g, 'from-amber-500/20 to-orange-600/5 border-amber-500/20');
content = content.replace(/from-amber-50 to-white border-amber-200 dark:from-amber-500\/20 dark:to-amber-600\/5 dark:border-amber-500\/20/g, 'from-amber-500/20 to-amber-600/5 border-amber-500/20');
content = content.replace(/from-violet-50 to-white border-violet-200 dark:from-violet-500\/20 dark:to-violet-600\/5 dark:border-violet-500\/20/g, 'from-violet-500/20 to-violet-600/5 border-violet-500/20');
content = content.replace(/from-emerald-50 to-white border-emerald-200 dark:from-emerald-500\/20 dark:to-emerald-600\/5 dark:border-emerald-500\/20/g, 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20');
content = content.replace(/from-cyan-50 to-white border-cyan-200 dark:from-cyan-500\/20 dark:to-cyan-600\/5 dark:border-cyan-500\/20/g, 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/20');
content = content.replace(/from-sky-50 to-white border-sky-200 dark:from-sky-500\/20 dark:to-sky-600\/5 dark:border-sky-500\/20/g, 'from-sky-500/20 to-sky-600/5 border-sky-500/20');
content = content.replace(/from-teal-50 to-white border-teal-200 dark:from-teal-500\/20 dark:to-teal-600\/5 dark:border-teal-500\/20/g, 'from-teal-500/20 to-teal-600/5 border-teal-500/20');

// Restore StatCard
content = content.replace(/interface StatCardProps \{[\s\S]*?function StatCard[^\}]+\}[\s\S]*?return \([\s\S]*?\}\);?\n\}/, `interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  accent?: string;
}

function StatCard({ label, value, icon, trend, trendLabel, accent = 'border-slate-200 dark:border-slate-800' }: StatCardProps) {
  return (
    <div className={\`rounded-xl border \${accent} bg-white dark:bg-slate-950/30 shadow-sm dark:shadow-none p-5 space-y-3 transition-all hover:bg-slate-50 dark:hover:bg-slate-950/50\`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/40">
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{value}</span>
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

// Restore QuickAction
content = content.replace(/interface QuickActionProps \{[\s\S]*?function QuickAction[^\}]+\}[\s\S]*?return \([\s\S]*?\}\);?\n\}/, `interface QuickActionProps {
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  accent: string;
}

function QuickAction({ label, description, href, icon, accent }: QuickActionProps) {
  return (
    <Link
      href={href}
      className={\`group flex items-center gap-4 rounded-xl border \${accent} bg-white dark:bg-slate-950/40 hover:bg-slate-50 dark:hover:bg-slate-950/60 p-4 transition-all hover:scale-[1.02] shadow-sm hover:shadow-md dark:shadow-none dark:hover:shadow-lg quick-action-tile\`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/60 quick-action-icon">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors quick-action-title">{label}</h4>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate quick-action-desc">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors shrink-0" />
    </Link>
  );
}`);


// Restore all StatCard colorTheme props back to accent
content = content.replace(/colorTheme="emerald"/g, 'accent="border-emerald-900/30"');
content = content.replace(/colorTheme="sky"/g, 'accent="border-sky-900/30"');
content = content.replace(/colorTheme="amber"/g, 'accent="border-amber-900/30"');
content = content.replace(/colorTheme="violet"/g, 'accent="border-violet-900/30"');
content = content.replace(/colorTheme="indigo"/g, 'accent="border-indigo-900/30"');
content = content.replace(/colorTheme="red"/g, 'accent="border-red-900/30"');
content = content.replace(/colorTheme="cyan"/g, 'accent="border-cyan-900/30"');

// Restore the icons that I modified
content = content.replace(/text-emerald-600 dark:text-emerald-400/g, 'text-emerald-400');
content = content.replace(/text-sky-600 dark:text-sky-400/g, 'text-sky-400');
content = content.replace(/text-amber-600 dark:text-amber-400/g, 'text-amber-400');
content = content.replace(/text-violet-600 dark:text-violet-400/g, 'text-violet-400');
content = content.replace(/text-indigo-600 dark:text-indigo-400/g, 'text-indigo-400');
content = content.replace(/text-red-600 dark:text-red-400/g, 'text-red-400');
content = content.replace(/text-cyan-600 dark:text-cyan-400/g, 'text-cyan-400');


// Restore Header Layout
const headerRegex = /<div className={\`rounded-2xl border bg-gradient-to-r \$\{config\.accent\} backdrop-blur-xl p-6 sm:p-8 shadow-sm dark:shadow-none\`}>[\s\S]*?{renderDashboardContent\(\)}/;
content = content.replace(headerRegex, `<div className={\`rounded-2xl border bg-gradient-to-r \${config.accent} backdrop-blur-xl p-6 sm:p-8\`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-950/50 border border-slate-800/50">
                {config.icon}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">{config.label}</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{config.tagline}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-300">{(user as any)?.name || user?.email || ''}</span>
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">{userRole.replace('_', ' ')}</span>
              </div>
              <div className="h-10 w-10 rounded-full bg-slate-900/60 border border-slate-700/50 flex items-center justify-center text-sm font-bold text-slate-300">
                {((user as any)?.name || user?.email || '?')[0].toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Role-Specific Content */}
        {renderDashboardContent()}`);


fs.writeFileSync(file, content);
