const fs = require('fs');
const file = '/Users/salimshaikh/Documents/societyApp/apps/backend/src/modules/maintenance/maintenance.service.ts';
let content = fs.readFileSync(file, 'utf8');

const bulkReplacer = `
  async recordBulkPayment(dto: {
    billIds: string[];
    amountPaid: number;
    paymentMode: 'CASH' | 'UPI' | 'NEFT' | 'CHEQUE' | 'CARD';
    transactionId?: string | null;
    depositAccountId?: string | null;
    paymentDate: string;
    userRemark?: string;
  }, executorId?: string) {
    const activeTenantId = this.maintenanceRepository['activeTenantId'];

    if (dto.billIds.length === 0) {
      throw new BadRequestException('At least one bill invoice must be selected.');
    }

    // Check user role
    let isResident = false;
    if (executorId) {
      const userRoleRecord = await this.db
        .select({ roleName: roles.name })
        .from(userSocieties)
        .innerJoin(roles, eq(userSocieties.roleId, roles.id))
        .where(and(eq(userSocieties.userId, executorId), eq(userSocieties.societyId, activeTenantId)))
        .limit(1);
      const roleName = userRoleRecord[0]?.roleName?.toUpperCase();
      isResident = ['OWNER', 'TENANT'].includes(roleName);
    }

    let remainingLumpSum = Number(dto.amountPaid);
    const createdReceipts: any[] = [];
    const updatedBills: string[] = [];

    const assetLedger = dto.paymentMode === 'CASH'
      ? await this.maintenanceRepository.findLedgerByName('Cash in Hand Account')
      : await this.maintenanceRepository.findLedgerByName('Bank Account SBI');
    const receivablesLedger = await this.maintenanceRepository.findLedgerByName('Maintenance Receivables');

    for (const billId of dto.billIds) {
      if (remainingLumpSum <= 0) break;

      const bill = await this.maintenanceRepository.findById(billId);
      if (!bill || bill.status === 'PAID') continue;

      const existingReceipts = await this.db
        .select()
        .from(receipts)
        .where(and(eq(receipts.billId, billId), eq(receipts.status, 'CLEARED')));

      const totalPaidSoFar = existingReceipts.reduce((sum, r) => sum + Number(r.amountPaid || 0), 0);
      const invoiceAmount = Number(bill.totalAmount);
      const billDue = Math.max(0, invoiceAmount - totalPaidSoFar);

      if (billDue <= 0) continue;

      const payThisBill = Math.min(remainingLumpSum, billDue);
      const newTotalPaid = totalPaidSoFar + payThisBill;
      const remainingForBill = Math.max(0, invoiceAmount - newTotalPaid);
      const nextStatus: 'PAID' | 'PARTIAL' = newTotalPaid >= invoiceAmount ? 'PAID' : 'PARTIAL';

      let receiptRecord: any = null;

      await this.db.transaction(async (tx) => {
        const receiptsList = await tx.insert(receipts).values({
          id: require('crypto').randomUUID(),
          societyId: activeTenantId,
          billId,
          receiptNumber: \`REC-\${Date.now()}-\${Math.floor(1000 + Math.random() * 9000)}\`,
          amountPaid: payThisBill.toFixed(2),
          paymentMode: dto.paymentMode,
          referenceNumber: dto.transactionId || null,
          depositAccountId: dto.depositAccountId || null,
          paymentDate: dto.paymentDate,
          status: isResident ? 'REVIEW' : 'CLEARED',
          userRemark: dto.userRemark || null,
        }).returning();

        receiptRecord = receiptsList[0];

        if (!isResident) {
          await tx
            .update(maintenanceBills)
            .set({ status: nextStatus })
            .where(eq(maintenanceBills.id, billId));

          const voucherId = require('crypto').randomUUID();
          await tx.insert(vouchers).values({
            id: voucherId,
            societyId: activeTenantId,
            voucherNumber: \`VOU-\${receiptRecord.receiptNumber}\`,
            type: 'RECEIPT',
            date: dto.paymentDate,
            narration: \`Bulk Payment Receipt for Invoice: \${bill.billNumber}\`,
          });

          await tx.insert(transactions).values({
            id: require('crypto').randomUUID(),
            societyId: activeTenantId,
            voucherId,
            ledgerId: assetLedger.id,
            type: 'DEBIT',
            amount: payThisBill.toFixed(2),
          });

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

      createdReceipts.push(receiptRecord);
      updatedBills.push(bill.billNumber);
      remainingLumpSum -= payThisBill;

      if (!isResident && nextStatus === 'PARTIAL') {
        const flatResident = await this.db.query.flatOwners.findFirst({
          where: eq(flatOwners.flatId, bill.flatId),
        });
        if (flatResident?.ownerId) {
          const ownerUser = await this.db.query.owners.findFirst({
            where: eq(owners.id, flatResident.ownerId),
          });
          if (ownerUser?.userId) {
            await this.notificationService.createInAppNotification({
              societyId: activeTenantId,
              recipientUserId: ownerUser.userId,
              title: '⚠️ Partial Maintenance Payment Received',
              body: \`Partial payment of ₹\${payThisBill} logged for Invoice \${bill.billNumber}. Remaining balance due: ₹\${remainingForBill.toFixed(2)}.\`,
            });
          }
        }
      }
    }

    if (isResident) {
      await this.notificationService.notifyRoles(
        ['PRESIDENT', 'SECRETARY', 'TREASURER', 'ACCOUNTANT'],
        '💳 Resident Submitted Bulk Payment for Review',
        \`Resident submitted lump-sum payment of ₹\${dto.amountPaid} for \${createdReceipts.length} invoices. Needs approval.\`
      );
    } else {
      await this.notificationService.notifyRoles(
        ['PRESIDENT', 'SECRETARY', 'TREASURER', 'ACCOUNTANT'],
        '💳 Multi-Invoice Bulk Payment Recorded',
        \`Lump-sum payment of ₹\${dto.amountPaid} (\${dto.paymentMode}) applied across \${createdReceipts.length} invoices (\${updatedBills.join(', ')}).\`
      );
    }

    return {
      appliedTo: createdReceipts.length,
      receipts: createdReceipts,
    };
  }

  async approvePayment(receiptId: string, approverId: string) {
    const activeTenantId = this.maintenanceRepository['activeTenantId'];

    const receipt = await this.db.query.receipts.findFirst({
      where: and(eq(receipts.id, receiptId), eq(receipts.societyId, activeTenantId)),
    });

    if (!receipt) throw new NotFoundException('Receipt not found.');
    if (receipt.status !== 'REVIEW') throw new BadRequestException('Receipt is not pending review.');

    const bill = await this.maintenanceRepository.findById(receipt.billId);
    if (!bill) throw new NotFoundException('Invoice not found for this receipt.');

    const invoiceAmount = Number(bill.totalAmount);
    const existingReceipts = await this.db
      .select()
      .from(receipts)
      .where(and(eq(receipts.billId, receipt.billId), eq(receipts.status, 'CLEARED')));
    const totalPaidSoFar = existingReceipts.reduce((sum, r) => sum + Number(r.amountPaid || 0), 0);
    const newTotalPaid = totalPaidSoFar + Number(receipt.amountPaid);
    
    let nextStatus: 'PAID' | 'PARTIAL' = 'PAID';
    if (newTotalPaid < invoiceAmount) {
      nextStatus = 'PARTIAL';
    }

    const assetLedger = receipt.paymentMode === 'CASH'
      ? await this.maintenanceRepository.findLedgerByName('Cash in Hand Account')
      : await this.maintenanceRepository.findLedgerByName('Bank Account SBI');
    const receivablesLedger = await this.maintenanceRepository.findLedgerByName('Maintenance Receivables');

    await this.db.transaction(async (tx) => {
      // Approve receipt
      await tx
        .update(receipts)
        .set({ status: 'CLEARED', approvedBy: approverId, rejectionReason: null })
        .where(eq(receipts.id, receiptId));

      // Update bill
      await tx
        .update(maintenanceBills)
        .set({ status: nextStatus })
        .where(eq(maintenanceBills.id, bill.id));

      // Post ledgers
      const voucherId = require('crypto').randomUUID();
      await tx.insert(vouchers).values({
        id: voucherId,
        societyId: activeTenantId,
        voucherNumber: \`VOU-\${receipt.receiptNumber}\`,
        type: 'RECEIPT',
        date: receipt.paymentDate,
        narration: \`Approved Maintenance Payment Receipt for Flat ID: \${bill.flatId}\`,
      });

      await tx.insert(transactions).values({
        id: require('crypto').randomUUID(),
        societyId: activeTenantId,
        voucherId,
        ledgerId: assetLedger.id,
        type: 'DEBIT',
        amount: Number(receipt.amountPaid).toFixed(2),
      });

      await tx.insert(transactions).values({
        id: require('crypto').randomUUID(),
        societyId: activeTenantId,
        voucherId,
        ledgerId: receivablesLedger.id,
        type: 'CREDIT',
        amount: Number(receipt.amountPaid).toFixed(2),
      });
    });

    await this.logAction({
      societyId: activeTenantId,
      userId: approverId,
      action: 'PAYMENT_RECEIPT_APPROVED',
      entityName: 'receipts',
      entityId: receipt.id,
      metadata: { amount: receipt.amountPaid, status: 'CLEARED' },
    });

    return { message: 'Payment approved successfully.' };
  }

  async rejectPayment(receiptId: string, reason: string, rejectorId: string) {
    const activeTenantId = this.maintenanceRepository['activeTenantId'];

    const receipt = await this.db.query.receipts.findFirst({
      where: and(eq(receipts.id, receiptId), eq(receipts.societyId, activeTenantId)),
    });

    if (!receipt) throw new NotFoundException('Receipt not found.');
    if (receipt.status !== 'REVIEW') throw new BadRequestException('Receipt is not pending review.');

    await this.db.transaction(async (tx) => {
      await tx
        .update(receipts)
        .set({ status: 'REJECTED', rejectionReason: reason })
        .where(eq(receipts.id, receiptId));
    });

    await this.logAction({
      societyId: activeTenantId,
      userId: rejectorId,
      action: 'PAYMENT_RECEIPT_REJECTED',
      entityName: 'receipts',
      entityId: receipt.id,
      metadata: { reason },
    });

    return { message: 'Payment rejected.' };
  }
`;

const regex = /async recordBulkPayment\([\s\S]*?appliedTo: createdReceipts\.length,\n      receipts: createdReceipts,\n    \};\n  \}/;
content = content.replace(regex, bulkReplacer.trim());

fs.writeFileSync(file, content);
