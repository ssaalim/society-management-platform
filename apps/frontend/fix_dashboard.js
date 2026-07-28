const fs = require('fs');
const file = '/Users/salimshaikh/Documents/societyApp/apps/frontend/src/app/[society_slug]/dashboard/page.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('pendingReviewsCount:')) {
  // Add to stats state interface (though it's implicitly any)
  // Let's find setStats
  content = content.replace(
    /collectionRate: totalBilled > 0 \? Math\.round\(\(totalCollected \/ totalBilled\) \* 100\) : 0,/,
    "collectionRate: totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0,\n        pendingReviewsCount: receipts.filter((r: any) => r.status === 'REVIEW').length,"
  );

  // Add the Pending Reviews card. We have 4 cards in the second row, we can make it 5? Or replace Total Flats? No, we can add a third row or just make it grid-cols-2 md:grid-cols-5, or put it next to Quick Actions.
  // Actually, we can add a new card in the first row:
  content = content.replace(
    /        <StatCard\n          label="Active Members"/,
    "        <StatCard\n          label=\"Pending Reviews\"\n          value={stats.pendingReviewsCount || 0}\n          icon={<Receipt className=\"h-4 w-4 text-blue-400\" />}\n          trend={stats.pendingReviewsCount > 0 ? 'down' : 'neutral'}\n          trendLabel={stats.pendingReviewsCount > 0 ? 'Action required' : 'All clear'}\n          accent=\"border-blue-900/30\"\n          colorTheme=\"sky\"\n        />\n        <StatCard\n          label=\"Active Members\""
  );
  content = content.replace(
    /<div className="grid grid-cols-2 md:grid-cols-4 gap-4">/,
    "<div className=\"grid grid-cols-2 md:grid-cols-5 gap-4\">"
  );
  
  // Wait, the first row is md:grid-cols-4. If I add one, I should make it md:grid-cols-5
  // But there are two instances of "grid grid-cols-2 md:grid-cols-4 gap-4"
  // Let's just do a string replacement for the first one only.
  
  fs.writeFileSync(file, content);
}
