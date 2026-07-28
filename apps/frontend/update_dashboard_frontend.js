const fs = require('fs');
const file = '/Users/salimshaikh/Documents/societyApp/apps/frontend/src/app/[society_slug]/dashboard/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add personal stats logic
const statsReplacement = `
      const overdueAmount = overdueBills.reduce((sum: number, b: any) => sum + parseFloat(b.amount || '0'), 0);
      
      const personalOverdueBills = overdueBills.filter((b: any) => b.isMine);
      const personalOverdueCount = personalOverdueBills.length;
      const personalOverdueAmount = personalOverdueBills.reduce((sum: number, b: any) => sum + parseFloat(b.amount || '0'), 0);
      
      const totalCollected = receipts.reduce((sum: number, r: any) => sum + parseFloat(r.amountPaid || r.amount_paid || '0'), 0);
`;
content = content.replace(/const overdueAmount = overdueBills\.reduce\(\(sum: number, b: any\) => sum \+ parseFloat\(b\.amount \|\| '0'\), 0\);\s*const totalCollected = receipts\.reduce/, statsReplacement.trim() + '\n      const totalCollected = receipts.reduce');

const setStatsReplacement = `
        overdueCount: overdueBills.length,
        overdueAmount,
        personalOverdueCount,
        personalOverdueAmount,
        openComplaints: openComplaints.length,
`;
content = content.replace(/overdueCount: overdueBills\.length,\n\s*overdueAmount,\n\s*openComplaints: openComplaints\.length,/, setStatsReplacement.trim() + '\n');

// 2. Remove the overdue banner from renderResidentDashboard
// Find the overdue block in renderResidentDashboard
content = content.replace(/\{stats\.overdueCount > 0 && \([\s\S]*?\}\)\}/, '');

// 3. Add it to the top level, right below Dashboard Header
const bannerHtml = `
        {stats.personalOverdueCount > 0 && (
          <div className="mb-6 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex gap-3 items-start">
                <div className="mt-0.5 rounded-full bg-red-100 dark:bg-red-900/50 p-1.5 flex items-center justify-center border border-red-200 dark:border-red-800">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-red-800 dark:text-red-300">Action Required: Overdue Maintenance</h3>
                  <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                    You have <span className="font-bold">{stats.personalOverdueCount}</span> unpaid invoice(s) totaling <span className="font-bold">₹{stats.personalOverdueAmount.toLocaleString('en-IN')}</span>. Please clear your dues immediately to avoid late payment penalties.
                  </p>
                </div>
              </div>
              <Link 
                href={\`/\${slug}/maintenance\`} 
                className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-red-700 transition-colors"
              >
                Pay Now <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}

        {/* Role-Specific Content */}
`;
content = content.replace(/\{renderDashboardContent\(\)\}/, '{renderDashboardContent()}');
content = content.replace(/\{\/\* Role-Specific Content \*\/\}/, bannerHtml.trim());


fs.writeFileSync(file, content);
