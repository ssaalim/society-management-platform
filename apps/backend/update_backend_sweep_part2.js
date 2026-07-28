const fs = require('fs');
const file = '/Users/salimshaikh/Documents/societyApp/apps/backend/src/modules/maintenance/maintenance.service.ts';
let content = fs.readFileSync('temp_view.js', 'utf8');

const endReplacement = `
        // Credit Income Account
        await tx.insert(transactions).values({
          id: require('crypto').randomUUID(),
          societyId: activeTenantId,
          voucherId,
          ledgerId: incomeLedger.id,
          type: 'CREDIT',
          amount: calculatedTotal.toString(),
        });

        generatedBillsList.push(bill);
      });
      } // End of billingPeriods loop
`;

content = content.replace(/\s*\/\/ Credit Income Account[\s\S]*?generatedBillsList\.push\(bill\);\n\s*\}\);/, endReplacement);

fs.writeFileSync(file, content);
