const fs = require('fs');
const file = '/Users/salimshaikh/Documents/societyApp/apps/backend/src/modules/maintenance/maintenance.service.ts';
let content = fs.readFileSync(file, 'utf8');

// I will just append approvePayment and rejectPayment to the end of the class.
// But first I need to update recordPayment and recordBulkPayment.

// recordPayment replacement
let recordPaymentReplacer = `
  async recordPayment(dto: CreateReceiptDto, executorId?: string) {
    const activeTenantId = this.maintenanceRepository['activeTenantId'];

    const bill = await this.maintenanceRepository.findById(dto.billId);
    if (!bill) {
      throw new NotFoundException('Bill invoice not found.');
    }

    if (bill.status === 'PAID') {
      throw new BadRequestException('Invoice is already fully paid.');
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

    const payAmount = Number(dto.amountPaid);
    const invoiceAmount = Number(bill.totalAmount);

    const existingReceipts = await this.db
      .select()
      .from(receipts)
      .where(and(eq(receipts.billId, dto.billId), eq(receipts.status, 'CLEARED')));

    const totalPaidSoFar = existingReceipts.reduce((sum, r) => sum + Number(r.amountPaid || 0), 0);
    const newTotalPaid = totalPaidSoFar + payAmount;
    const remainingBalance = Math.max(0, invoiceAmount - newTotalPaid);

    let nextStatus: 'PAID' | 'PARTIAL' = 'PAID';
    if (newTotalPaid < invoiceAmount) {
      nextStatus = 'PARTIAL';
    }

    const assetLedger = dto.paymentMode === 'CASH'
      ? await this.maintenanceRepository.findLedgerByName('Cash in Hand Account')
      : await this.maintenanceRepository.findLedgerByName('Bank Account SBI');
    const receivablesLedger = await this.maintenanceRepository.findLedgerByName('Maintenance Receivables');

    let receiptRecord: any = null;

    await this.db.transaction(async (tx) => {
      // Insert receipt
      const receiptsList = await tx.insert(receipts).values({
        id: require('crypto').randomUUID(),
        societyId: activeTenantId,
        billId: dto.billId,
        receiptNumber: \`REC-\${Date.now()}-\${Math.floor(1000 + Math.random() * 9000)}\`,
        amountPaid: payAmount.toFixed(2),
        paymentMode: dto.paymentMode,
        referenceNumber: dto.transactionId || null,
        depositAccountId: dto.depositAccountId || null,
        paymentDate: dto.paymentDate,
        status: isResident ? 'REVIEW' : 'CLEARED',
        userRemark: dto.userRemark || null,
      }).returning();

      receiptRecord = receiptsList[0];

      if (!isResident) {
        // Update invoice status
        await tx
          .update(maintenanceBills)
          .set({ status: nextStatus })
          .where(eq(maintenanceBills.id, dto.billId));

        // Post double-entry payment receipt voucher
        const voucherId = require('crypto').randomUUID();
        await tx.insert(vouchers).values({
          id: voucherId,
          societyId: activeTenantId,
          voucherNumber: \`VOU-\${receiptRecord.receiptNumber}\`,
          type: 'RECEIPT',
          date: dto.paymentDate,
          narration: \`Maintenance Payment Receipt for Flat ID: \${bill.flatId}\`,
        });

        // Debit Asset Account
        await tx.insert(transactions).values({
          id: require('crypto').randomUUID(),
          societyId: activeTenantId,
          voucherId,
          ledgerId: assetLedger.id,
          type: 'DEBIT',
          amount: payAmount.toFixed(2),
        });

        // Credit Receivables Account
        await tx.insert(transactions).values({
          id: require('crypto').randomUUID(),
          societyId: activeTenantId,
          voucherId,
          ledgerId: receivablesLedger.id,
          type: 'CREDIT',
          amount: payAmount.toFixed(2),
        });
      }
    });

    await this.logAction({
      societyId: activeTenantId,
      userId: executorId,
      action: isResident ? 'PAYMENT_RECEIPT_SUBMITTED' : 'PAYMENT_RECEIPT_CREATE',
      entityName: 'receipts',
      entityId: receiptRecord.id,
      metadata: { amount: payAmount, status: isResident ? 'REVIEW' : 'CLEARED' },
    });

    return { ...receiptRecord, remainingBalance };
  }`;

// Use regex to replace the recordPayment method
const recordPaymentRegex = /async recordPayment\([\s\S]*?return \{ \.\.\.receiptRecord, remainingBalance \};\n  \}/;
content = content.replace(recordPaymentRegex, recordPaymentReplacer.trim());

fs.writeFileSync(file, content);
