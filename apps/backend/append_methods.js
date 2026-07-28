const fs = require('fs');
const file = '/Users/salimshaikh/Documents/societyApp/apps/backend/src/modules/maintenance/maintenance.service.ts';
let content = fs.readFileSync(file, 'utf8');

const methods = `
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
}
`;

content = content.replace(/}\s*$/, methods);
fs.writeFileSync(file, content);
