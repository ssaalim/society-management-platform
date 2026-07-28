const fs = require('fs');
const file = '/Users/salimshaikh/Documents/societyApp/apps/frontend/src/app/[society_slug]/dashboard/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update stats computation
const computeStatsReplacement = `
      // Compute stats
      const totalBilled = bills.reduce((sum: number, b: any) => sum + parseFloat(b.amount || '0'), 0);
      const paidBills = bills.filter((b: any) => b.status === 'PAID');
      const unpaidBills = bills.filter((b: any) => b.status === 'UNPAID');
      const overdueBills = bills.filter((b: any) => b.status === 'OVERDUE');
      
      const unpaidAmount = unpaidBills.reduce((sum: number, b: any) => sum + parseFloat(b.amount || '0'), 0);
      const overdueAmount = overdueBills.reduce((sum: number, b: any) => sum + parseFloat(b.amount || '0'), 0);
      
      const totalCollected = receipts.reduce((sum: number, r: any) => sum + parseFloat(r.amountPaid || r.amount_paid || '0'), 0);
      const openComplaints = complaints.filter((c: any) => c.status === 'OPEN' || c.status === 'ASSIGNED');
      const resolvedComplaints = complaints.filter((c: any) => c.status === 'RESOLVED' || c.status === 'CLOSED');

      setStats({
        totalBilled,
        totalCollected,
        outstanding: totalBilled - totalCollected,
        paidCount: paidBills.length,
        unpaidCount: unpaidBills.length,
        unpaidAmount,
        overdueCount: overdueBills.length,
        overdueAmount,
        openComplaints: openComplaints.length,
        resolvedComplaints: resolvedComplaints.length,
        totalComplaints: complaints.length,
        membersCount: members.length,
        flatsCount: flats.length,
        collectionRate: totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0,
      });
`;

content = content.replace(/\/\/ Compute stats[\s\S]*?setStats\(\{[\s\S]*?\}\);/, computeStatsReplacement.trim());

// 2. Update Management Dashboard
const mgmtRow2 = `      {/* Second Row KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Flats"
          value={stats.flatsCount || 0}
          icon={<Building className="h-4 w-4 text-indigo-400" />}
          accent="border-indigo-900/30"
        />
        <StatCard
          label="Paid Invoices"
          value={stats.paidCount || 0}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          accent="border-emerald-900/30"
        />
        <StatCard
          label="Unpaid Invoices"
          value={stats.unpaidCount || 0}
          icon={<CreditCard className="h-4 w-4 text-amber-400" />}
          trend={stats.unpaidCount > 0 ? 'down' : 'up'}
          trendLabel={stats.unpaidCount > 0 ? 'Pending' : 'All clear'}
          accent="border-amber-900/30"
        />
        <StatCard
          label="Overdue Invoices"
          value={stats.overdueCount || 0}
          icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
          trend={stats.overdueCount > 0 ? 'down' : 'up'}
          trendLabel={stats.overdueCount > 0 ? \`₹\${stats.overdueAmount?.toLocaleString('en-IN') || '0'} Due\` : 'All clear'}
          accent="border-red-900/30"
        />
      </div>`;

content = content.replace(/\{\/\* Second Row KPIs \*\/\}[\s\S]*?<\/div>/, mgmtRow2);

// 3. Update Resident Dashboard
const residentDashboard = `const renderResidentDashboard = () => (
    <>
      {stats.overdueCount > 0 && (
        <div className="mb-6 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-4 shadow-sm">
          <div className="flex gap-3 items-start">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-800 dark:text-red-400">Payment Overdue Alert</h3>
              <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                You have {stats.overdueCount} overdue maintenance {stats.overdueCount === 1 ? 'bill' : 'bills'} totaling <strong>₹{stats.overdueAmount?.toLocaleString('en-IN')}</strong>. 
                Please clear your dues at the earliest to avoid late fees.
              </p>
              <div className="mt-3">
                <Link href={\`/\${slug}/maintenance\`} className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-500">
                  Pay Now
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">`;

content = content.replace(/const renderResidentDashboard = \(\) => \(\n    <>\n      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">/, residentDashboard);

fs.writeFileSync(file, content);
console.log('done');
