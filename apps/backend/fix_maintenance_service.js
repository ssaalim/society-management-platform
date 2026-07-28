const fs = require('fs');
const file = '/Users/salimshaikh/Documents/societyApp/apps/backend/src/modules/maintenance/maintenance.service.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Add missing imports
content = content.replace(
  /owners\n\} from '\.\.\/\.\.\/\.\.\/database\/schema';/,
  "owners,\n  userSocieties,\n  roles\n} from '../../../database/schema';"
);

// 2. Update recordPayment
const recordPaymentStart = "const activeTenantId = this.maintenanceRepository['activeTenantId'];";
const recordPaymentAdd = `
    let isResident = false;
    if (executorId) {
      const userRoleQuery = await this.db
        .select({ roleName: roles.name })
        .from(userSocieties)
        .innerJoin(roles, eq(userSocieties.roleId, roles.id))
        .where(
          and(
            eq(userSocieties.userId, executorId),
            eq(userSocieties.societyId, activeTenantId)
          )
        );
      if (userRoleQuery.length > 0) {
        isResident = ['OWNER', 'TENANT'].includes(userRoleQuery[0].roleName);
      }
    }
`;
content = content.replace(recordPaymentStart, recordPaymentStart + recordPaymentAdd);

content = content.replace(
  /await tx\n\s*\.update\(maintenanceBills\)\n\s*\.set\(\{ status: nextStatus \}\)\n\s*\.where\(eq\(maintenanceBills\.id, dto\.billId\)\);/,
  "if (!isResident) {\n        await tx\n          .update(maintenanceBills)\n          .set({ status: nextStatus })\n          .where(eq(maintenanceBills.id, dto.billId));\n      }"
);

content = content.replace(
  /paymentDate: dto\.paymentDate,\n\s*\}\)\.returning\(\);/,
  "paymentDate: dto.paymentDate,\n        status: isResident ? 'REVIEW' : 'CLEARED',\n      }).returning();"
);

content = content.replace(
  /const voucherId = require\('crypto'\)\.randomUUID\(\);/,
  "if (!isResident) {\n        const voucherId = require('crypto').randomUUID();"
);

content = content.replace(
  /amount: payAmount\.toFixed\(2\),\n\s*\}\);\n\s*\}\);/,
  "amount: payAmount.toFixed(2),\n        });\n      }\n    });"
);

// 3. Update recordBulkPayment
const recordBulkPaymentStart = "const activeTenantId = this.maintenanceRepository['activeTenantId'];";
content = content.replace(
  /async recordBulkPayment[\s\S]*?const activeTenantId = this.maintenanceRepository\['activeTenantId'\];/,
  `async recordBulkPayment(dto: {
    billIds: string[];
    amountPaid: number;
    paymentMode: 'CASH' | 'UPI' | 'NEFT' | 'CHEQUE' | 'CARD';
    transactionId?: string | null;
    depositAccountId?: string | null;
    paymentDate: string;
  }, executorId?: string) {
    const activeTenantId = this.maintenanceRepository['activeTenantId'];
` + recordPaymentAdd
);

content = content.replace(
  /await tx\n\s*\.update\(maintenanceBills\)\n\s*\.set\(\{ status: nextStatus \}\)\n\s*\.where\(eq\(maintenanceBills\.id, billId\)\);/,
  "if (!isResident) {\n          await tx\n            .update(maintenanceBills)\n            .set({ status: nextStatus })\n            .where(eq(maintenanceBills.id, billId));\n        }"
);

content = content.replace(
  /paymentDate: dto\.paymentDate,\n\s*\}\)\.returning\(\);/g,
  "paymentDate: dto.paymentDate,\n          status: isResident ? 'REVIEW' : 'CLEARED',\n        }).returning();"
);

content = content.replace(
  /\/\/ 3\. Post double-entry payment receipt voucher\n\s*const voucherId = require\('crypto'\)\.randomUUID\(\);/,
  "// 3. Post double-entry payment receipt voucher\n        if (!isResident) {\n          const voucherId = require('crypto').randomUUID();"
);

// The end of transaction in bulk payment:
//         await tx.insert(transactions).values({
//           ...
//         });
//       });
// We need to close the `if (!isResident)` block.
// Let's use string replacement very carefully.
const endOfBulkTx = `
        // Credit Receivables Account
        await tx.insert(transactions).values({
          id: require('crypto').randomUUID(),
          societyId: activeTenantId,
          voucherId,
          ledgerId: receivablesLedger.id,
          type: 'CREDIT',
          amount: payThisBill.toFixed(2),
        });
      });
`;
const newEndOfBulkTx = `
        // Credit Receivables Account
        await tx.insert(transactions).values({
          id: require('crypto').randomUUID(),
          societyId: activeTenantId,
          voucherId,
          ledgerId: receivablesLedger.id,
          type: 'CREDIT',
          amount: payThisBill.toFixed(2),
        });
        }
      });
`;
content = content.replace(endOfBulkTx, newEndOfBulkTx);

fs.writeFileSync(file, content);
