const fs = require('fs');

const file = '/Users/salimshaikh/Documents/societyApp/apps/frontend/src/app/[society_slug]/dashboard/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Simplify StatCard
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

// Simplify QuickAction
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

// Revert all colorTheme to accent
content = content.replace(/colorTheme="emerald"/g, 'accent="border-emerald-200 dark:border-emerald-900/30"');
content = content.replace(/colorTheme="sky"/g, 'accent="border-sky-200 dark:border-sky-900/30"');
content = content.replace(/colorTheme="amber"/g, 'accent="border-amber-200 dark:border-amber-900/30"');
content = content.replace(/colorTheme="violet"/g, 'accent="border-violet-200 dark:border-violet-900/30"');
content = content.replace(/colorTheme="indigo"/g, 'accent="border-indigo-200 dark:border-indigo-900/30"');
content = content.replace(/colorTheme="red"/g, 'accent="border-red-200 dark:border-red-900/30"');
content = content.replace(/colorTheme="cyan"/g, 'accent="border-cyan-200 dark:border-cyan-900/30"');
content = content.replace(/colorTheme="teal"/g, 'accent="border-teal-200 dark:border-teal-900/30"');

// Fix Header
content = content.replace(/<div className={\`rounded-2xl border bg-gradient-to-r \$\{config\.accent\} backdrop-blur-xl p-6 sm:p-8\`}>[\s\S]*?{renderDashboardContent\(\)}/, `<div className={\`rounded-2xl border bg-gradient-to-r \${config.accent} backdrop-blur-xl p-6 sm:p-8 shadow-sm dark:shadow-none\`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/80 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/50 shadow-sm dark:shadow-none">
                {config.icon}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{config.label}</h1>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{config.tagline}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{(user as any)?.name || user?.email || ''}</span>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">{userRole.replace('_', ' ')}</span>
              </div>
              <div className="h-10 w-10 rounded-full bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/50 flex items-center justify-center text-sm font-bold text-slate-700 dark:text-slate-300 shadow-sm dark:shadow-none">
                {((user as any)?.name || user?.email || '?')[0].toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Role-Specific Content */}
        {renderDashboardContent()}`);

fs.writeFileSync(file, content);
