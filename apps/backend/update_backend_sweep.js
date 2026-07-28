const fs = require('fs');
const file = '/Users/salimshaikh/Documents/societyApp/apps/backend/src/modules/maintenance/maintenance.service.ts';
let content = fs.readFileSync(file, 'utf8');

const prefixReplacement = `
    const formula = currentConfig.maintenanceFormula || '(area * rate) + parking + water';

    const generationType = dto.generationType || 'SINGLE';
    
    // Compute billing periods based on generation type
    let billingPeriods: { start: string, end: string }[] = [];
    
    if (generationType === 'PER_MONTH') {
      const start = new Date(dto.periodStart);
      const end = new Date(dto.periodEnd);
      let current = new Date(start.getFullYear(), start.getMonth(), 1);
      
      while (current <= end) {
        const periodStart = new Date(Math.max(current.getTime(), start.getTime()));
        const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1);
        const periodEnd = new Date(Math.min(nextMonth.getTime() - 1, end.getTime()));
        
        billingPeriods.push({
          start: periodStart.toISOString().substring(0, 10),
          end: periodEnd.toISOString().substring(0, 10),
        });
        current = nextMonth;
      }
    } else {
      billingPeriods.push({
        start: dto.periodStart,
        end: dto.periodEnd,
      });
    }

    for (const flat of targetFlats) {`;

content = content.replace(/const formula = currentConfig\.maintenanceFormula[\s\S]*?for \(const flat of targetFlats\) \{/, prefixReplacement.trim());

const innerLoopReplacement = `
      // 4. Calculate total maintenance using algebraic formula evaluator
      let calculatedTotal = baseAmount + parkingCharge + waterCharge;
      try {
        calculatedTotal = evaluateFormula(formula, variables);
      } catch (e) {
        console.warn(\`Formula evaluation fallback for Flat \${flat.number}:\`, e);
      }

      for (const period of billingPeriods) {
        // Generate invoice coordinates
        const billNumber = \`INV-\${new Date().getFullYear()}-\${flat.number}-\${Math.floor(1000 + Math.random() * 9000)}\`;

        // 5. Write invoice transaction block
        await this.db.transaction(async (tx) => {
          const newBills = await tx.insert(maintenanceBills).values({
            societyId: activeTenantId,
            flatId: flat.id,
            billNumber,
            billingPeriodStart: period.start,
            billingPeriodEnd: period.end,
            dueDate: dto.dueDate,
            totalAmount: calculatedTotal.toString(),
            status: 'UNPAID',
          }).returning();`;

content = content.replace(/\/\/ 4\. Calculate total maintenance[\s\S]*?status: 'UNPAID',\n\s*\}\)\.returning\(\);/, innerLoopReplacement.trim());

// We need to close the `for (const period of billingPeriods)` loop!
// The transaction block ends with `});`. So we find that and add `}` after it.
// The transaction block is: `        });\n\n      generatedBillsList.push(bill.id);` (wait, is it?)
// Let's check exactly how it ends.

fs.writeFileSync('temp_view.js', content);
