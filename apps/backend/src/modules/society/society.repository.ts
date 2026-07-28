import { Injectable, Inject } from '@nestjs/common';
import { GlobalBaseRepository } from '@core/database/base.repository';
import { societies, userSocieties, users, roles, bankAccounts, ledgers } from '../../../database/schema';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class SocietyRepository extends GlobalBaseRepository<typeof societies> {
  constructor(@Inject(DRIZZLE_PROVIDER) protected readonly db: DrizzleDB) {
    super(db, societies);
  }

  /**
   * Retrieves a society details by ID including bank accounts and active committee list.
   */
  async findDetailsById(id: string) {
    const society = await this.findById(id);
    if (!society) return null;

    // Fetch primary bank details
    const banks = await this.db
      .select({
        id: bankAccounts.id,
        bankName: bankAccounts.bankName,
        accountNumber: bankAccounts.accountNumber,
        ifsc: bankAccounts.ifsc,
        branchName: bankAccounts.branchName,
        type: bankAccounts.type,
        openingBalance: bankAccounts.openingBalance,
        isDefault: bankAccounts.isDefault,
        ledgerId: bankAccounts.ledgerId,
      })
      .from(bankAccounts)
      .where(eq(bankAccounts.societyId, id));

    // Fetch committee members list
    const committee = await this.db
      .select({
        userSocietyId: userSocieties.id,
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
        roleName: roles.name,
      })
      .from(userSocieties)
      .innerJoin(users, eq(userSocieties.userId, users.id))
      .innerJoin(roles, eq(userSocieties.roleId, roles.id))
      .where(eq(userSocieties.societyId, id));

    return {
      ...society,
      bankAccounts: banks,
      committee,
    };
  }

  /**
   * Fetches all bank accounts configured for a society.
   */
  async getBankAccounts(societyId: string) {
    return this.db
      .select({
        id: bankAccounts.id,
        bankName: bankAccounts.bankName,
        accountNumber: bankAccounts.accountNumber,
        ifsc: bankAccounts.ifsc,
        branchName: bankAccounts.branchName,
        type: bankAccounts.type,
        openingBalance: bankAccounts.openingBalance,
        isDefault: bankAccounts.isDefault,
        ledgerId: bankAccounts.ledgerId,
      })
      .from(bankAccounts)
      .where(eq(bankAccounts.societyId, societyId));
  }

  /**
   * Finds or creates a Bank Asset Ledger in the Chart of Accounts for a bank account.
   */
  async findOrCreateBankLedger(societyId: string, bankName: string, accountNumber: string) {
    const ledgerName = `${bankName} - ${accountNumber.slice(-4)}`;
    const existing = await this.db
      .select()
      .from(ledgers)
      .where(and(eq(ledgers.societyId, societyId), eq(ledgers.name, ledgerName)));

    if (existing.length > 0) {
      return existing[0].id;
    }

    const [newLedger] = await this.db
      .insert(ledgers)
      .values({
        societyId,
        name: ledgerName,
        group: 'ASSET',
        code: `BANK-${Math.floor(100 + Math.random() * 900)}`,
      })
      .returning();

    return newLedger.id;
  }

  /**
   * Creates a new society bank account.
   */
  async addBankAccount(societyId: string, data: {
    bankName: string;
    accountNumber: string;
    ifsc: string;
    branchName?: string;
    type?: string;
    openingBalance?: string;
    isDefault?: boolean;
  }) {
    const ledgerId = await this.findOrCreateBankLedger(societyId, data.bankName, data.accountNumber);

    if (data.isDefault) {
      // Clear previous default flags
      await this.db
        .update(bankAccounts)
        .set({ isDefault: false })
        .where(eq(bankAccounts.societyId, societyId));
    }

    const [newAccount] = await this.db
      .insert(bankAccounts)
      .values({
        societyId,
        ledgerId,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        ifsc: data.ifsc,
        branchName: data.branchName || null,
        type: data.type || 'SAVINGS',
        openingBalance: data.openingBalance || '0.00',
        isDefault: data.isDefault || false,
      })
      .returning();

    return newAccount;
  }

  /**
   * Updates an existing bank account.
   */
  async updateBankAccount(societyId: string, accountId: string, data: any) {
    if (data.isDefault) {
      await this.db
        .update(bankAccounts)
        .set({ isDefault: false })
        .where(eq(bankAccounts.societyId, societyId));
    }

    const [updated] = await this.db
      .update(bankAccounts)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(bankAccounts.id, accountId), eq(bankAccounts.societyId, societyId)))
      .returning();

    return updated;
  }

  /**
   * Removes a bank account.
   */
  async deleteBankAccount(societyId: string, accountId: string) {
    const [deleted] = await this.db
      .delete(bankAccounts)
      .where(and(eq(bankAccounts.id, accountId), eq(bankAccounts.societyId, societyId)))
      .returning();

    return deleted;
  }

  /**
   * Finds a society by its unique slug.
   */
  async findBySlug(slug: string) {
    const society = await this.db.query.societies.findFirst({
      where: (s, { eq }) => eq(s.slug, slug),
    });
    return society;
  }
}
