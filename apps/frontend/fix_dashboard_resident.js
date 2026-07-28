const fs = require('fs');
const file = '/Users/salimshaikh/Documents/societyApp/apps/frontend/src/app/[society_slug]/dashboard/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Compute residentOverdueCount
content = content.replace(
  /const overdueBills = bills.filter\(\(b: any\) => b.status === 'OVERDUE'\);/,
  `const overdueBills = bills.filter((b: any) => b.status === 'OVERDUE');\n      \n      const pendingReviewReceipts = receipts.filter((r: any) => r.status === 'REVIEW');\n      const billsWithPendingReview = new Set(pendingReviewReceipts.map((r: any) => r.billId || r.bill_id || r.maintenanceBillId));\n      const residentOverdueBills = overdueBills.filter((b: any) => !billsWithPendingReview.has(b.id));`
);

// 2. Add to stats
content = content.replace(
  /overdueAmount,/,
  `overdueAmount,\n        residentOverdueCount: residentOverdueBills.length,\n        residentOverdueAmount: residentOverdueBills.reduce((sum: number, b: any) => sum + parseFloat(b.amount || '0'), 0),`
);

// 3. Update resident rendering
content = content.replace(
  /stats\.overdueCount > 0/g,
  `stats.residentOverdueCount > 0`
);
content = content.replace(
  /You have \{stats\.overdueCount\} overdue maintenance \{stats\.overdueCount === 1 \? 'bill' : 'bills'\}/,
  `You have {stats.residentOverdueCount} overdue maintenance {stats.residentOverdueCount === 1 ? 'bill' : 'bills'}`
);
content = content.replace(
  /₹\{stats\.overdueAmount\?\.toLocaleString\('en-IN'\)\}/,
  `₹{stats.residentOverdueAmount?.toLocaleString('en-IN')}`
);

fs.writeFileSync(file, content);
