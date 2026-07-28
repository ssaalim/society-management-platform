const fs = require('fs');
const file = '/Users/salimshaikh/Documents/societyApp/apps/backend/src/modules/maintenance/maintenance.repository.ts';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
    const whereClauses = [eq(maintenanceBills.societyId, this.activeTenantId)];

    if (filters.status) {
      whereClauses.push(eq(maintenanceBills.status, filters.status));
    }
    if (filters.search) {
      whereClauses.push(like(flats.number, \`%\${filters.search}%\`));
    }

    let userFlatIds: string[] = [];
    if (filters.userId) {
      const ownedFlats = await this.db
        .select({ flatId: flatOwners.flatId })
        .from(flatOwners)
        .innerJoin(owners, eq(flatOwners.ownerId, owners.id))
        .where(eq(owners.userId, filters.userId));

      const rentedFlats = await this.db
        .select({ flatId: flatTenants.flatId })
        .from(flatTenants)
        .innerJoin(tenants, eq(flatTenants.tenantId, tenants.id))
        .where(
          and(
            eq(tenants.userId, filters.userId),
            eq(flatTenants.isActive, true)
          )
        );

      userFlatIds = [
        ...ownedFlats.map((f) => f.flatId),
        ...rentedFlats.map((f) => f.flatId),
      ];
    }

    if (['OWNER', 'TENANT'].includes(userRoleName) && filters.userId) {
      if (userFlatIds.length > 0) {
        whereClauses.push(inArray(maintenanceBills.flatId, userFlatIds));
      } else {
        return [];
      }
    }
`;

content = content.replace(/const whereClauses = \[eq\(maintenanceBills\.societyId, this\.activeTenantId\)\];[\s\S]*?return \[\];\n\s*\}\n\s*\}/, replacement.trim());

// Also append `isMine` to the return map
const returnReplacement = `
    return rawBills.map((b) => {
      const bTotal = Number(b.totalAmount || 0);
      const bPaid = Number(b.totalPaid || 0);
      return {
        ...b,
        amount: bTotal,
        remainingBalance: Math.max(0, bTotal - bPaid).toFixed(2),
        periodStart: b.billingPeriodStart,
        periodEnd: b.billingPeriodEnd,
        isMine: userFlatIds.includes(b.flatId),
      };
    });
`;
content = content.replace(/return rawBills\.map\(\(b\) => \{[\s\S]*?\}\);\n  \}/, returnReplacement.trim() + '\n  }');

fs.writeFileSync(file, content);
