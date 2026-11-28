import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { LedgerResolver } from '@core/accounting/ledger-resolver.service';
import {
  auditLogs,
  flats,
  floors,
  fundCampaigns,
  fundExpenses,
  fundOnlineOrders,
  fundPaymentClaims,
  fundPayments,
  fundShares,
  ledgers,
  roles,
  transactions,
  userSocieties,
  users,
  vouchers,
  wings,
} from '../../../database/schema';
import { NotificationService } from '../notification/notification.service';
import { CampaignDto, FundClaimDto, FundExpenseDto, FundPaymentDto } from './dto/fund.dto';
import { RazorpayService } from './razorpay.service';

type Campaign = typeof fundCampaigns.$inferSelect;

/** Who runs funds: issue shares, record payments and spending. */
const MANAGERS = ['SUPER_ADMIN', 'SOCIETY_ADMIN', 'PRESIDENT', 'SECRETARY', 'TREASURER', 'ACCOUNTANT'];
const RESIDENT_ROLES = ['OWNER', 'CO_OWNER', 'TENANT', 'FAMILY_MEMBER', 'MEMBER'];
/** Who can approve or reject payments residents report: the money people plus the committee. */
const APPROVERS = [...MANAGERS, 'VICE_PRESIDENT', 'JOINT_SECRETARY', 'CULTURAL_SECRETARY', 'COMMITTEE_MEMBER', 'COMMITTEE'];
const METHOD_LABEL: Record<string, string> = { EQUAL: 'Equal per flat', BY_AREA: 'By area', BY_FLAT_TYPE: 'By flat type', VOLUNTARY: 'Voluntary' };
const round2 = (n: number) => Math.round(n * 100) / 100;
const yearIST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric' }).format(new Date());
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

interface Actor {
  userId: string;
  isManager: boolean;
  isApprover: boolean;
  isOffice: boolean;
  flatIds: string[];
}

/**
 * Fund collection (generator, solar, repainting): each campaign has a target, its own fund ledger, per-flat shares
 * billed as separate demands (never on the maintenance bill), payments into the fund and spending out of it.
 */
@Injectable()
export class FundService {
  private readonly logger = new Logger(FundService.name);

  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly cls: ClsService,
    private readonly ledgerResolver: LedgerResolver,
    private readonly notificationService: NotificationService,
    private readonly razorpay: RazorpayService,
  ) {}

  private get societyId(): string {
    const id = this.cls.get<string>('tenantId');
    if (!id) throw new BadRequestException('Society context is missing.');
    return id;
  }

  private async actor(userId: string): Promise<Actor> {
    const [row] = await this.db
      .select({ role: roles.name })
      .from(userSocieties)
      .innerJoin(roles, eq(roles.id, userSocieties.roleId))
      .where(and(eq(userSocieties.userId, userId), eq(userSocieties.societyId, this.societyId)));
    const role = row?.role || '';
    const flatRows = (await this.db.execute(sql`
      select fo.flat_id as "flatId" from owners o join flat_owners fo on fo.owner_id = o.id and fo.is_current
      where o.user_id = ${userId} and o.society_id = ${this.societyId}
      union
      select ft.flat_id from tenants t join flat_tenants ft on ft.tenant_id = t.id and ft.is_active
      where t.user_id = ${userId} and ft.society_id = ${this.societyId}
    `)) as unknown as { flatId: string }[];
    return {
      userId,
      isManager: MANAGERS.includes(role),
      isApprover: APPROVERS.includes(role),
      isOffice: !!role && !RESIDENT_ROLES.includes(role),
      flatIds: flatRows.map((r) => r.flatId),
    };
  }

  private async assertManager(userId: string) {
    const a = await this.actor(userId);
    if (!a.isManager) throw new ForbiddenException('Only the Treasurer, Secretary, President, Accountant or society admin can do this.');
    return a;
  }

  private async campaign(id: string): Promise<Campaign> {
    const [c] = await this.db.select().from(fundCampaigns).where(and(eq(fundCampaigns.id, id), eq(fundCampaigns.societyId, this.societyId)));
    if (!c) throw new NotFoundException('Fund not found.');
    return c;
  }

  /** Collected, spent and outstanding for each campaign. */
  private progressSql() {
    return {
      collected: sql<string>`(select coalesce(sum(p.amount), 0) from fund_payments p where p.campaign_id = fund_campaigns.id and p.reversed_at is null)`,
      pendingClaims: sql<number>`(select count(*)::int from fund_payment_claims c where c.campaign_id = fund_campaigns.id and c.status = 'PENDING')`,
      spent: sql<string>`(select coalesce(sum(e.amount), 0) from fund_expenses e where e.campaign_id = fund_campaigns.id)`,
      demanded: sql<string>`(select coalesce(sum(s.amount), 0) from fund_shares s where s.campaign_id = fund_campaigns.id and s.status <> 'WAIVED')`,
      waived: sql<string>`(select coalesce(sum(s.amount - s.paid_amount), 0) from fund_shares s where s.campaign_id = fund_campaigns.id and s.status = 'WAIVED')`,
      shareCount: sql<number>`(select count(*)::int from fund_shares s where s.campaign_id = fund_campaigns.id)`,
      paidCount: sql<number>`(select count(*)::int from fund_shares s where s.campaign_id = fund_campaigns.id and s.status = 'PAID')`,
    };
  }

  private withProgress(c: Campaign, p: any) {
    const collected = Number(p.collected);
    const spent = Number(p.spent);
    return {
      ...c,
      methodLabel: METHOD_LABEL[c.method] || c.method,
      collected,
      spent,
      balance: round2(collected - spent),
      demanded: Number(p.demanded),
      waived: Number(p.waived),
      shareCount: p.shareCount,
      paidCount: p.paidCount,
      pendingClaims: p.pendingClaims,
      percent: Number(c.targetAmount) > 0 ? Math.min(100, Math.round((collected / Number(c.targetAmount)) * 100)) : 0,
    };
  }

  // ---------------------------------------------------------------- campaigns

  async list(userId: string) {
    const me = await this.actor(userId);
    const rows = await this.db
      .select({ c: fundCampaigns, ...this.progressSql() })
      .from(fundCampaigns)
      .where(and(eq(fundCampaigns.societyId, this.societyId), me.isOffice ? undefined : sql`${fundCampaigns.status} <> 'DRAFT'`))
      .orderBy(sql`case ${fundCampaigns.status} when 'ACTIVE' then 0 when 'DRAFT' then 1 else 2 end`, desc(fundCampaigns.createdAt));
    const out = [];
    for (const r of rows) {
      const base = this.withProgress(r.c, r);
      // My flats' shares, so the list can say "you owe ₹X".
      const mine = me.flatIds.length
        ? await this.db
            .select({ amount: fundShares.amount, paidAmount: fundShares.paidAmount, status: fundShares.status })
            .from(fundShares)
            .where(and(eq(fundShares.campaignId, r.c.id), inArray(fundShares.flatId, me.flatIds)))
        : [];
      const myDue = mine.filter((s) => s.status !== 'WAIVED').reduce((n, s) => n + Number(s.amount) - Number(s.paidAmount), 0);
      out.push({ ...base, pendingClaims: me.isApprover ? base.pendingClaims : 0, myDue: round2(myDue), myShares: mine.length });
    }
    return out;
  }

  async detail(id: string, userId: string) {
    const me = await this.actor(userId);
    const c = await this.campaign(id);
    if (c.status === 'DRAFT' && !me.isOffice) throw new NotFoundException('Fund not found.');
    const [p] = await this.db.select(this.progressSql()).from(fundCampaigns).where(eq(fundCampaigns.id, id));

    const shareRows = await this.db
      .select({ share: fundShares, number: flats.number, wing: wings.name, flatType: flats.flatType, area: flats.sqftArea })
      .from(fundShares)
      .innerJoin(flats, eq(flats.id, fundShares.flatId))
      .leftJoin(floors, eq(floors.id, flats.floorId))
      .leftJoin(wings, eq(wings.id, floors.wingId))
      .where(and(eq(fundShares.campaignId, id), me.isOffice ? undefined : me.flatIds.length ? inArray(fundShares.flatId, me.flatIds) : sql`false`))
      .orderBy(asc(wings.name), asc(flats.number));
    const shares = shareRows
      .map((r) => ({ ...r.share, flatLabel: r.wing ? `${r.wing}-${r.number}` : r.number, flatType: r.flatType, area: r.area, due: round2(Number(r.share.amount) - Number(r.share.paidAmount)) }))
      .sort((a, b) => a.flatLabel.localeCompare(b.flatLabel, 'en', { numeric: true }));

    const payRows = await this.db
      .select({ pay: fundPayments, flatLabel: sql<string | null>`(select coalesce(w.name || '-', '') || f.number from flats f left join floors fl on fl.id = f.floor_id left join wings w on w.id = fl.wing_id where f.id = ${fundPayments.flatId})` })
      .from(fundPayments)
      .where(and(eq(fundPayments.campaignId, id), me.isOffice ? undefined : me.flatIds.length ? inArray(fundPayments.flatId, me.flatIds) : sql`false`))
      .orderBy(desc(fundPayments.paidAt), desc(fundPayments.createdAt));

    // Spending is shown to every member: it is the society's money.
    const expenses = await this.db
      .select({ e: fundExpenses, assetName: ledgers.name })
      .from(fundExpenses)
      .leftJoin(ledgers, eq(ledgers.id, fundExpenses.assetLedgerId))
      .where(eq(fundExpenses.campaignId, id))
      .orderBy(desc(fundExpenses.spentAt));

    // Payments residents reported: the approvers see all, residents their flats'.
    const claimRows = await this.db
      .select({
        claim: fundPaymentClaims,
        submittedByName: users.name,
        flatLabel: sql<string | null>`(select coalesce(w.name || '-', '') || f.number from flats f left join floors fl on fl.id = f.floor_id left join wings w on w.id = fl.wing_id where f.id = ${fundPaymentClaims.flatId})`,
      })
      .from(fundPaymentClaims)
      .leftJoin(users, eq(users.id, fundPaymentClaims.submittedBy))
      .where(
        and(
          eq(fundPaymentClaims.campaignId, id),
          me.isApprover ? undefined : me.flatIds.length ? inArray(fundPaymentClaims.flatId, me.flatIds) : sql`false`,
        ),
      )
      .orderBy(desc(fundPaymentClaims.createdAt))
      .limit(200);
    const claims = claimRows.map((r) => ({ ...r.claim, submittedByName: r.submittedByName, flatLabel: r.flatLabel }));
    const pendingByShare = new Map<string, number>();
    for (const cl of claims) if (cl.status === 'PENDING' && cl.shareId) pendingByShare.set(cl.shareId, (pendingByShare.get(cl.shareId) || 0) + Number(cl.amount));

    return {
      ...this.withProgress(c, p),
      canManage: me.isManager,
      canApprove: me.isApprover,
      onlinePayments: this.razorpay.enabled,
      shares: shares.map((sh) => ({ ...sh, pendingClaimed: round2(pendingByShare.get(sh.id) || 0), mine: me.flatIds.includes(sh.flatId) })),
      payments: payRows.map((r) => ({ ...r.pay, flatLabel: r.flatLabel })),
      expenses: expenses.map((x) => ({ ...x.e, assetName: x.assetName })),
      claims,
    };
  }

  async create(dto: CampaignDto, userId: string) {
    await this.assertManager(userId);
    const fund = await this.ledgerResolver.fund(dto.name.toLowerCase().includes('fund') ? dto.name : `${dto.name} Fund`);
    const [row] = await this.db
      .insert(fundCampaigns)
      .values({ ...this.toRow(dto), societyId: this.societyId, status: 'DRAFT', ledgerId: fund.id, createdBy: userId })
      .returning();
    await this.audit(userId, 'FUND_CREATE', row.id, row);
    return this.detail(row.id, userId);
  }

  private toRow(dto: CampaignDto) {
    return {
      name: dto.name,
      description: dto.description,
      targetAmount: dto.targetAmount.toFixed(2),
      method: dto.method,
      perFlatAmount: dto.method === 'EQUAL' && dto.perFlatAmount != null ? dto.perFlatAmount.toFixed(2) : null,
      ratePerSqft: dto.method === 'BY_AREA' && dto.ratePerSqft != null ? String(dto.ratePerSqft) : null,
      typeAmounts: dto.method === 'BY_FLAT_TYPE' ? dto.typeAmounts : null,
      dueDate: dto.dueDate,
      accountingMode: dto.accountingMode,
      updatedAt: new Date(),
    };
  }

  async update(id: string, dto: CampaignDto, userId: string) {
    await this.assertManager(userId);
    const c = await this.campaign(id);
    if (c.status === 'DRAFT') {
      await this.db.update(fundCampaigns).set(this.toRow(dto)).where(eq(fundCampaigns.id, id));
    } else {
      // Shares are already issued: only the wording, target and due date can change.
      if (dto.method !== c.method) throw new ConflictException('Shares have been issued, so the way they are worked out can no longer change.');
      if (dto.accountingMode !== c.accountingMode) throw new ConflictException('Shares have been issued, so the accounting basis can no longer change.');
      await this.db
        .update(fundCampaigns)
        .set({ name: dto.name, description: dto.description, targetAmount: dto.targetAmount.toFixed(2), dueDate: dto.dueDate, updatedAt: new Date() })
        .where(eq(fundCampaigns.id, id));
    }
    await this.audit(userId, 'FUND_UPDATE', id, dto);
    return this.detail(id, userId);
  }

  async remove(id: string, userId: string) {
    await this.assertManager(userId);
    const c = await this.campaign(id);
    if (c.status !== 'DRAFT') throw new ConflictException('Only drafts can be deleted. Close the fund instead.');
    await this.db.delete(fundCampaigns).where(eq(fundCampaigns.id, id));
    // Its fund ledger was never used, so it goes too.
    if (c.ledgerId) {
      const [{ n }] = await this.db.select({ n: sql<number>`count(*)::int` }).from(transactions).where(eq(transactions.ledgerId, c.ledgerId));
      const [{ m }] = await this.db.select({ m: sql<number>`count(*)::int` }).from(fundCampaigns).where(eq(fundCampaigns.ledgerId, c.ledgerId));
      if (!n && !m) await this.db.delete(ledgers).where(eq(ledgers.id, c.ledgerId));
    }
    await this.audit(userId, 'FUND_DELETE', id, { name: c.name });
    return { deleted: true };
  }

  // ---------------------------------------------------------------- shares

  /** Each flat's share by the campaign's method, for review before issuing. */
  async preview(id: string, userId: string) {
    await this.assertManager(userId);
    const c = await this.campaign(id);
    const rows = await this.db
      .select({ id: flats.id, number: flats.number, wing: wings.name, flatType: flats.flatType, area: flats.sqftArea })
      .from(flats)
      .leftJoin(floors, eq(floors.id, flats.floorId))
      .leftJoin(wings, eq(wings.id, floors.wingId))
      .where(and(eq(flats.societyId, this.societyId), isNull(flats.deletedAt)));
    const types = (c.typeAmounts || {}) as Record<string, number>;
    const shares = rows
      .map((f) => {
        const amount =
          c.method === 'EQUAL'
            ? Number(c.perFlatAmount)
            : c.method === 'BY_AREA'
              ? Math.round(Number(c.ratePerSqft) * Number(f.area))
              : c.method === 'BY_FLAT_TYPE'
                ? Number(types[f.flatType] || 0)
                : 0;
        return { flatId: f.id, flatLabel: f.wing ? `${f.wing}-${f.number}` : f.number, flatType: f.flatType, area: Number(f.area), amount };
      })
      .sort((a, b) => a.flatLabel.localeCompare(b.flatLabel, 'en', { numeric: true }));
    const total = round2(shares.reduce((n, s) => n + s.amount, 0));
    const flatTypes = [...new Set(rows.map((r) => r.flatType))].sort();
    return {
      method: c.method,
      shares,
      total,
      target: Number(c.targetAmount),
      flatTypes,
      totalArea: rows.reduce((n, r) => n + Number(r.area), 0),
      flatCount: rows.length,
      untyped: c.method === 'BY_FLAT_TYPE' ? flatTypes.filter((t) => !(types[t] > 0)) : [],
    };
  }

  /** Issues the reviewed shares as separate demands and opens the fund. */
  async issue(id: string, shares: { flatId: string; amount: number }[], userId: string) {
    await this.assertManager(userId);
    const c = await this.campaign(id);
    if (c.status !== 'DRAFT') throw new ConflictException('This fund has already been opened.');
    const list = shares.filter((s) => s.amount > 0).map((s) => ({ ...s, amount: round2(s.amount) }));
    if (c.method !== 'VOLUNTARY' && !list.length) throw new BadRequestException('No flat has a share to pay.');
    if (new Set(list.map((s) => s.flatId)).size !== list.length) throw new BadRequestException('A flat appears twice.');
    if (list.length) {
      const valid = await this.db
        .select({ id: flats.id })
        .from(flats)
        .where(and(eq(flats.societyId, this.societyId), inArray(flats.id, list.map((s) => s.flatId))));
      if (valid.length !== list.length) throw new BadRequestException('Some flats are not part of this society.');
    }

    // Accrual basis: the shares go into the books now, as money owed to the fund.
    const total = round2(list.reduce((n, s) => n + s.amount, 0));
    const accrue = c.accountingMode === 'ACCRUAL' && total > 0;
    const receivable = accrue ? await this.ledgerResolver.system('FUND_RECEIVABLES') : null;
    const fundLedgerId = c.ledgerId || (await this.ledgerResolver.fund(`${c.name} Fund`)).id;

    await this.db.transaction(async (tx) => {
      const [locked] = await tx.select({ status: fundCampaigns.status }).from(fundCampaigns).where(eq(fundCampaigns.id, id)).for('update');
      if (locked?.status !== 'DRAFT') throw new ConflictException('This fund has already been opened.');
      let next = await this.nextNumber(tx, 'FND', 'invoice');
      for (const s of list) {
        await tx.insert(fundShares).values({ societyId: this.societyId, campaignId: id, flatId: s.flatId, amount: s.amount.toFixed(2), invoiceNumber: next.format() });
        next = next.inc();
      }
      let issueVoucherId: string | null = null;
      if (accrue && receivable) {
        const [v] = await tx
          .insert(vouchers)
          .values({ societyId: this.societyId, voucherNumber: `VOU-FND-ISSUE-${Date.now()}`, type: 'JOURNAL', date: today(), narration: `${c.name}: ${list.length} shares issued` })
          .returning();
        await tx.insert(transactions).values([
          { societyId: this.societyId, voucherId: v.id, ledgerId: receivable.id, type: 'DEBIT', amount: total.toFixed(2) },
          { societyId: this.societyId, voucherId: v.id, ledgerId: fundLedgerId, type: 'CREDIT', amount: total.toFixed(2) },
        ]);
        issueVoucherId = v.id;
      }
      await tx.update(fundCampaigns).set({ status: 'ACTIVE', issuedAt: new Date(), issueVoucherId, updatedAt: new Date() }).where(eq(fundCampaigns.id, id));
    });
    await this.audit(userId, 'FUND_ISSUE', id, { shares: list.length, total: list.reduce((n, s) => n + s.amount, 0) });

    // Tell each flat its share (or everyone, for a voluntary collection).
    const due = c.dueDate ? ` by ${new Date(`${c.dueDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : '';
    if (c.method === 'VOLUNTARY') {
      const all = (await this.db.execute(sql`select distinct m.user_id as "userId" from members m where m.society_id = ${this.societyId} and m.status = 'ACTIVE'`)) as unknown as { userId: string }[];
      for (const u of all) await this.tell(u.userId, `Contributions: ${c.name}`, `The society is collecting voluntary contributions towards ${rupees(Number(c.targetAmount))}. Pay at the society office${this.razorpay.enabled ? ' or online in the app' : ''}.`);
    } else {
      for (const s of list) {
        for (const u of await this.residentsOf(s.flatId)) {
          await this.tell(u, `Fund: ${c.name}`, `Your flat's share is ${rupees(s.amount)}${due}. This is separate from your maintenance bill. Pay at the office${this.razorpay.enabled ? ' or online' : ''}, or tell us in the app once you have paid.`);
        }
      }
    }
    return this.detail(id, userId);
  }

  /** Waives what is left of a share (hardship, flat sold, decided by the committee). */
  async waive(shareId: string, reason: string, userId: string) {
    await this.assertManager(userId);
    const [s] = await this.db.select().from(fundShares).where(and(eq(fundShares.id, shareId), eq(fundShares.societyId, this.societyId)));
    if (!s) throw new NotFoundException('Share not found.');
    if (!['UNPAID', 'PARTIAL'].includes(s.status)) throw new ConflictException('Only unpaid shares can be waived.');
    const c = await this.campaign(s.campaignId);
    const left = round2(Number(s.amount) - Number(s.paidAmount));
    // Accrual basis: what is waived comes back out of the receivable.
    const reverse = c.accountingMode === 'ACCRUAL' && left > 0;
    const receivable = reverse ? await this.ledgerResolver.system('FUND_RECEIVABLES') : null;
    const fundLedgerId = c.ledgerId || (await this.ledgerResolver.fund(`${c.name} Fund`)).id;
    await this.db.transaction(async (tx) => {
      let waiveVoucherId: string | null = null;
      if (reverse && receivable) {
        const [v] = await tx
          .insert(vouchers)
          .values({ societyId: this.societyId, voucherNumber: `VOU-FND-WAIVE-${s.invoiceNumber}`, type: 'JOURNAL', date: today(), narration: `${c.name}: share ${s.invoiceNumber} waived (${reason})` })
          .returning();
        await tx.insert(transactions).values([
          { societyId: this.societyId, voucherId: v.id, ledgerId: fundLedgerId, type: 'DEBIT', amount: left.toFixed(2) },
          { societyId: this.societyId, voucherId: v.id, ledgerId: receivable.id, type: 'CREDIT', amount: left.toFixed(2) },
        ]);
        waiveVoucherId = v.id;
      }
      await tx.update(fundShares).set({ status: 'WAIVED', waivedReason: reason, waiveVoucherId, updatedAt: new Date() }).where(eq(fundShares.id, shareId));
    });
    await this.audit(userId, 'FUND_SHARE_WAIVE', shareId, { reason });
    return this.detail(s.campaignId, userId);
  }

  // ---------------------------------------------------------------- money in and out

  /**
   * Records money received: against a flat's share (no more than what is left of it) or as a voluntary contribution.
   * Posts a receipt voucher: debit cash/bank, credit the fund.
   */
  async recordPayment(id: string, dto: FundPaymentDto, userId: string) {
    await this.assertManager(userId);
    const payment = await this.postPayment(await this.campaign(id), dto, userId, { source: 'OFFICE' });
    return { ...(await this.detail(id, userId)), lastReceipt: payment.receiptNumber };
  }

  /**
   * Books a payment (office, approved resident report, or verified online payment). Debit cash/bank; credit the fund
   * (cash basis, or no share) or the fund receivable (accrual basis, against a share).
   */
  private async postPayment(
    c: Campaign,
    dto: FundPaymentDto,
    userId: string | null,
    extra: { source: 'OFFICE' | 'CLAIM' | 'ONLINE'; razorpayPaymentId?: string; allowClosed?: boolean },
  ) {
    const id = c.id;
    if (c.status === 'DRAFT' || (c.status === 'CLOSED' && !extra.allowClosed)) {
      throw new ConflictException(c.status === 'DRAFT' ? 'Open the fund first.' : 'This fund is closed. Reopen it to record a payment.');
    }
    const amount = round2(dto.amount);
    let flatId = dto.flatId;

    if (dto.shareId) {
      const [s] = await this.db.select().from(fundShares).where(and(eq(fundShares.id, dto.shareId), eq(fundShares.campaignId, id)));
      if (!s) throw new BadRequestException('That share is not part of this fund.');
      flatId = s.flatId;
    } else if (c.method !== 'VOLUNTARY' && dto.flatId) {
      // A flat with a share pays against it.
      const [s] = await this.db.select({ id: fundShares.id }).from(fundShares).where(and(eq(fundShares.campaignId, id), eq(fundShares.flatId, dto.flatId)));
      if (s) dto = { ...dto, shareId: s.id };
    }
    if (flatId) {
      const [f] = await this.db.select({ id: flats.id }).from(flats).where(and(eq(flats.id, flatId), eq(flats.societyId, this.societyId)));
      if (!f) throw new BadRequestException('That flat is not part of this society.');
    }

    const money = await this.ledgerResolver.money({ mode: dto.paymentMode, bankAccountId: dto.bankAccountId });
    const fundLedgerId = c.ledgerId || (await this.ledgerResolver.fund(`${c.name} Fund`)).id;
    const creditLedgerId = c.accountingMode === 'ACCRUAL' && dto.shareId ? (await this.ledgerResolver.system('FUND_RECEIVABLES')).id : fundLedgerId;

    const payment = await this.db.transaction(async (tx) => {
      if (dto.shareId) {
        const [s] = await tx.select().from(fundShares).where(eq(fundShares.id, dto.shareId)).for('update');
        if (s.status === 'WAIVED') throw new ConflictException('This share was waived.');
        const left = round2(Number(s.amount) - Number(s.paidAmount));
        if (left <= 0) throw new ConflictException('This share is already fully paid.');
        if (amount > left) throw new BadRequestException(`Only ${rupees(left)} is due on this share.`);
        const paid = round2(Number(s.paidAmount) + amount);
        await tx
          .update(fundShares)
          .set({ paidAmount: paid.toFixed(2), status: paid >= Number(s.amount) ? 'PAID' : 'PARTIAL', updatedAt: new Date() })
          .where(eq(fundShares.id, s.id));
      }
      const receiptNumber = (await this.nextNumber(tx, 'FCR', 'receipt')).format();
      const [v] = await tx
        .insert(vouchers)
        .values({
          societyId: this.societyId,
          voucherNumber: `VOU-${receiptNumber}`,
          type: 'RECEIPT',
          date: dto.paidAt,
          narration: `${c.name}: contribution${dto.payerName ? ` from ${dto.payerName}` : ''}${dto.reference ? `, ref ${dto.reference}` : ''}`,
        })
        .returning();
      await tx.insert(transactions).values([
        { societyId: this.societyId, voucherId: v.id, ledgerId: money.id, type: 'DEBIT', amount: amount.toFixed(2) },
        { societyId: this.societyId, voucherId: v.id, ledgerId: creditLedgerId, type: 'CREDIT', amount: amount.toFixed(2) },
      ]);
      const [row] = await tx
        .insert(fundPayments)
        .values({
          societyId: this.societyId,
          campaignId: id,
          shareId: dto.shareId,
          flatId,
          payerName: dto.payerName,
          amount: amount.toFixed(2),
          paidAt: dto.paidAt,
          paymentMode: dto.paymentMode,
          bankAccountId: money.bankAccountId,
          reference: dto.reference,
          receiptNumber,
          voucherId: v.id,
          recordedBy: userId,
          source: extra.source,
          razorpayPaymentId: extra.razorpayPaymentId || null,
        })
        .returning();
      return row;
    });

    await this.audit(userId || undefined, 'FUND_PAYMENT', payment.id, { campaignId: id, amount, receipt: payment.receiptNumber, source: extra.source });
    if (flatId) {
      for (const u of await this.residentsOf(flatId)) await this.tell(u, `Received: ${c.name}`, `${rupees(amount)} received, receipt ${payment.receiptNumber}. Thank you.`);
    }
    return payment;
  }

  /** Reverses a recorded payment (bounced cheque, wrong entry): contra voucher, and the share is due again. */
  async reversePayment(paymentId: string, reason: string, userId: string) {
    await this.assertManager(userId);
    const [pay] = await this.db.select().from(fundPayments).where(and(eq(fundPayments.id, paymentId), eq(fundPayments.societyId, this.societyId)));
    if (!pay) throw new NotFoundException('Payment not found.');
    if (pay.reversedAt) throw new ConflictException('This payment has already been reversed.');
    const c = await this.campaign(pay.campaignId);
    await this.db.transaction(async (tx) => {
      const [locked] = await tx.select({ reversedAt: fundPayments.reversedAt }).from(fundPayments).where(eq(fundPayments.id, paymentId)).for('update');
      if (locked?.reversedAt) throw new ConflictException('This payment has already been reversed.');
      if (pay.shareId) {
        const [s] = await tx.select().from(fundShares).where(eq(fundShares.id, pay.shareId)).for('update');
        if (s?.status === 'WAIVED') throw new ConflictException('The rest of this share was waived; reversing this payment is not possible.');
        if (s) {
          const paid = round2(Math.max(0, Number(s.paidAmount) - Number(pay.amount)));
          await tx
            .update(fundShares)
            .set({ paidAmount: paid.toFixed(2), status: paid <= 0 ? 'UNPAID' : 'PARTIAL', updatedAt: new Date() })
            .where(eq(fundShares.id, s.id));
        }
      }
      // The same lines, the other way round.
      let reversalVoucherId: string | null = null;
      if (pay.voucherId) {
        const lines = await tx.select().from(transactions).where(eq(transactions.voucherId, pay.voucherId));
        const [v] = await tx
          .insert(vouchers)
          .values({ societyId: this.societyId, voucherNumber: `VOU-REV-${pay.receiptNumber}`, type: 'JOURNAL', date: today(), narration: `${c.name}: receipt ${pay.receiptNumber} reversed (${reason})` })
          .returning();
        await tx.insert(transactions).values(
          lines.map((l) => ({ societyId: this.societyId, voucherId: v.id, ledgerId: l.ledgerId, type: l.type === 'DEBIT' ? 'CREDIT' : 'DEBIT', amount: l.amount })),
        );
        reversalVoucherId = v.id;
      }
      await tx
        .update(fundPayments)
        .set({ reversedAt: new Date(), reversedBy: userId, reverseReason: reason, reversalVoucherId })
        .where(eq(fundPayments.id, paymentId));
    });
    await this.audit(userId, 'FUND_PAYMENT_REVERSE', paymentId, { reason, receipt: pay.receiptNumber });
    if (pay.flatId) {
      for (const u of await this.residentsOf(pay.flatId)) {
        await this.tell(u, `Payment reversed: ${c.name}`, `Receipt ${pay.receiptNumber} (${rupees(Number(pay.amount))}) was reversed: ${reason}. The amount is due again.`);
      }
    }
    return this.detail(c.id, userId);
  }

  // ---------------------------------------------------------------- payments residents report

  /** A resident tells the office they have paid (UPI, transfer, cheque). It counts once someone approves it. */
  async submitClaim(id: string, dto: FundClaimDto, userId: string) {
    const me = await this.actor(userId);
    const c = await this.campaign(id);
    if (c.status !== 'ACTIVE') throw new ConflictException('This fund is not collecting payments.');
    let flatId = dto.flatId;
    let shareId: string | null = null;
    if (c.method !== 'VOLUNTARY') {
      const [s] = await this.db
        .select()
        .from(fundShares)
        .where(and(eq(fundShares.campaignId, id), dto.shareId ? eq(fundShares.id, dto.shareId) : flatId ? eq(fundShares.flatId, flatId) : sql`false`));
      if (!s || !me.flatIds.includes(s.flatId)) throw new ForbiddenException('You can report payments only for your own flat.');
      if (!['UNPAID', 'PARTIAL'].includes(s.status)) throw new ConflictException(s.status === 'WAIVED' ? 'This share was waived.' : 'This share is already paid.');
      const [{ pending }] = await this.db
        .select({ pending: sql<string>`coalesce(sum(${fundPaymentClaims.amount}), 0)` })
        .from(fundPaymentClaims)
        .where(and(eq(fundPaymentClaims.shareId, s.id), eq(fundPaymentClaims.status, 'PENDING')));
      const left = round2(Number(s.amount) - Number(s.paidAmount) - Number(pending));
      if (left <= 0) throw new ConflictException('Payments you reported already cover this share; they are waiting for approval.');
      if (dto.amount > left) throw new BadRequestException(`Only ${rupees(left)} is still due on this share.`);
      shareId = s.id;
      flatId = s.flatId;
    } else {
      flatId = flatId || me.flatIds[0] || null;
      if (!flatId || !me.flatIds.includes(flatId)) throw new ForbiddenException('You can report payments only for your own flat.');
    }
    const [row] = await this.db
      .insert(fundPaymentClaims)
      .values({
        societyId: this.societyId,
        campaignId: id,
        shareId,
        flatId,
        amount: round2(dto.amount).toFixed(2),
        paidAt: dto.paidAt,
        paymentMode: dto.paymentMode,
        reference: dto.reference,
        note: dto.note,
        proofUrl: dto.proofUrl,
        submittedBy: userId,
      })
      .returning();
    await this.audit(userId, 'FUND_CLAIM_SUBMIT', row.id, { campaignId: id, amount: dto.amount, reference: dto.reference });
    await this.notificationService.notifyRoles(
      APPROVERS,
      `Payment to approve: ${c.name}`,
      `${rupees(dto.amount)} reported paid by ${dto.paymentMode}${dto.reference ? ` (ref ${dto.reference})` : ''}. Open the fund to approve or reject it.`,
    );
    return this.detail(id, userId);
  }

  private async claim(claimId: string) {
    const [cl] = await this.db.select().from(fundPaymentClaims).where(and(eq(fundPaymentClaims.id, claimId), eq(fundPaymentClaims.societyId, this.societyId)));
    if (!cl) throw new NotFoundException('Reported payment not found.');
    return cl;
  }

  /** Approves a reported payment: records it (receipt, books) into the account it was paid to. */
  async approveClaim(claimId: string, dto: { bankAccountId: string | null; paidAt: string | null }, userId: string) {
    const me = await this.actor(userId);
    if (!me.isApprover) throw new ForbiddenException('Only the Treasurer, Accountant or committee members can approve payments.');
    const cl = await this.claim(claimId);
    if (cl.status !== 'PENDING') throw new ConflictException('This report has already been handled.');
    if (cl.submittedBy === userId) throw new ForbiddenException('Someone else must approve a payment you reported yourself.');
    const c = await this.campaign(cl.campaignId);
    // Claim it first, so two approvers can't record it twice.
    const [taken] = await this.db
      .update(fundPaymentClaims)
      .set({ status: 'APPROVED', decidedBy: userId, decidedAt: new Date() })
      .where(and(eq(fundPaymentClaims.id, claimId), eq(fundPaymentClaims.status, 'PENDING')))
      .returning({ id: fundPaymentClaims.id });
    if (!taken) throw new ConflictException('This report has already been handled.');
    try {
      const payment = await this.postPayment(
        c,
        {
          shareId: cl.shareId,
          flatId: cl.flatId,
          payerName: null,
          amount: Number(cl.amount),
          paidAt: dto.paidAt || cl.paidAt,
          paymentMode: cl.paymentMode as FundPaymentDto['paymentMode'],
          bankAccountId: dto.bankAccountId,
          reference: cl.reference,
        },
        userId,
        { source: 'CLAIM', allowClosed: true },
      );
      await this.db.update(fundPaymentClaims).set({ paymentId: payment.id }).where(eq(fundPaymentClaims.id, claimId));
    } catch (err) {
      await this.db.update(fundPaymentClaims).set({ status: 'PENDING', decidedBy: null, decidedAt: null }).where(eq(fundPaymentClaims.id, claimId));
      throw err;
    }
    await this.audit(userId, 'FUND_CLAIM_APPROVE', claimId, null);
    return this.detail(c.id, userId);
  }

  async rejectClaim(claimId: string, reason: string, userId: string) {
    const me = await this.actor(userId);
    if (!me.isApprover) throw new ForbiddenException('Only the Treasurer, Accountant or committee members can reject payments.');
    const cl = await this.claim(claimId);
    const [row] = await this.db
      .update(fundPaymentClaims)
      .set({ status: 'REJECTED', decidedBy: userId, decidedAt: new Date(), rejectReason: reason })
      .where(and(eq(fundPaymentClaims.id, claimId), eq(fundPaymentClaims.status, 'PENDING')))
      .returning();
    if (!row) throw new ConflictException('This report has already been handled.');
    await this.audit(userId, 'FUND_CLAIM_REJECT', claimId, { reason });
    const c = await this.campaign(cl.campaignId);
    if (cl.submittedBy) {
      await this.tell(cl.submittedBy, `Payment not confirmed: ${c.name}`, `The ${rupees(Number(cl.amount))} you reported (${cl.reference || cl.paymentMode}) was not confirmed: ${reason}. The amount is still due.`);
    }
    return this.detail(c.id, userId);
  }

  // ---------------------------------------------------------------- online payment (Razorpay)

  /** Starts an online payment of what is due on my share (or a voluntary amount). */
  async createOnlineOrder(id: string, dto: { shareId: string | null; amount: number | null }, userId: string) {
    if (!this.razorpay.enabled) throw new BadRequestException('Online payment is not set up for this society.');
    const me = await this.actor(userId);
    const c = await this.campaign(id);
    if (c.status !== 'ACTIVE') throw new ConflictException('This fund is not collecting payments.');
    let amount: number;
    let shareId: string | null = null;
    if (c.method !== 'VOLUNTARY') {
      const [s] = await this.db.select().from(fundShares).where(and(eq(fundShares.id, dto.shareId || ''), eq(fundShares.campaignId, id)));
      if (!s || !me.flatIds.includes(s.flatId)) throw new ForbiddenException('You can pay only your own flat’s share.');
      amount = round2(Number(s.amount) - Number(s.paidAmount));
      if (s.status === 'WAIVED' || amount <= 0) throw new ConflictException('Nothing is due on this share.');
      shareId = s.id;
    } else {
      amount = round2(dto.amount || 0);
      if (amount < 1) throw new BadRequestException('Enter the amount you want to give.');
    }
    const order = await this.razorpay.createOrder(amount, `fund-${c.id.slice(0, 8)}-${Date.now()}`, { campaignId: c.id, societyId: this.societyId });
    await this.db.insert(fundOnlineOrders).values({ societyId: this.societyId, campaignId: id, shareId, userId, razorpayOrderId: order.id, amount: amount.toFixed(2) });
    return { orderId: order.id, amount: order.amount, currency: order.currency, keyId: this.razorpay.keyId, name: c.name };
  }

  /** The browser hands back the payment after checkout; recorded only if Razorpay's signature checks out. */
  async verifyOnline(dto: { orderId: string; paymentId: string; signature: string }, userId: string) {
    if (!this.razorpay.verifyPayment(dto.orderId, dto.paymentId, dto.signature)) throw new BadRequestException('The payment could not be verified.');
    const id = await this.recordOnline(dto.orderId, dto.paymentId);
    return this.detail(id, userId);
  }

  /**
   * Razorpay's server-to-server notice (payment captured): records the payment even if the resident closed the
   * browser before returning. Idempotent with verifyOnline.
   */
  async onlineWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
    if (!rawBody || !this.razorpay.verifyWebhook(rawBody, signature)) throw new BadRequestException('Invalid webhook signature.');
    const event = JSON.parse(rawBody.toString('utf8'));
    if (event?.event !== 'payment.captured' && event?.event !== 'order.paid') return { ignored: true };
    const p = event?.payload?.payment?.entity;
    if (!p?.order_id || !p?.id) return { ignored: true };
    const [order] = await this.db.select().from(fundOnlineOrders).where(eq(fundOnlineOrders.razorpayOrderId, p.order_id));
    if (!order) return { ignored: true }; // not a fund payment
    await this.cls.run(async () => {
      this.cls.set('tenantId', order.societyId);
      await this.recordOnline(p.order_id, p.id);
    });
    return { recorded: true };
  }

  private async recordOnline(orderId: string, paymentId: string): Promise<string> {
    const [order] = await this.db.select().from(fundOnlineOrders).where(eq(fundOnlineOrders.razorpayOrderId, orderId));
    if (!order || order.societyId !== this.societyId) throw new NotFoundException('Payment order not found.');
    if (order.status === 'PAID') return order.campaignId; // already recorded (browser and webhook both arrived)
    const [taken] = await this.db
      .update(fundOnlineOrders)
      .set({ status: 'PAID' })
      .where(and(eq(fundOnlineOrders.id, order.id), eq(fundOnlineOrders.status, 'CREATED')))
      .returning({ id: fundOnlineOrders.id });
    if (!taken) return order.campaignId;
    const c = await this.campaign(order.campaignId);
    let share: typeof fundShares.$inferSelect | undefined;
    if (order.shareId) [share] = await this.db.select().from(fundShares).where(eq(fundShares.id, order.shareId));
    const due = share ? round2(Number(share.amount) - Number(share.paidAmount)) : Number(order.amount);
    // If the share was paid meanwhile (e.g. at the office), the money still goes into the fund, not against the share.
    const againstShare = !!share && due >= Number(order.amount) && share.status !== 'WAIVED';
    const payment = await this.postPayment(
      c,
      {
        shareId: againstShare ? order.shareId : null,
        flatId: share?.flatId || null,
        payerName: share ? null : 'Online contribution',
        amount: Number(order.amount),
        paidAt: today(),
        paymentMode: 'UPI',
        bankAccountId: null,
        reference: paymentId,
      },
      order.userId,
      { source: 'ONLINE', razorpayPaymentId: paymentId, allowClosed: true },
    );
    await this.db.update(fundOnlineOrders).set({ paymentId: payment.id }).where(eq(fundOnlineOrders.id, order.id));
    return c.id;
  }

  /** Spending out of the fund: debit the fund, credit cash/bank. Can't spend more than the fund holds. */
  async recordExpense(id: string, dto: FundExpenseDto, userId: string) {
    await this.assertManager(userId);
    const c = await this.campaign(id);
    if (c.status === 'DRAFT') throw new ConflictException('Open the fund first.');
    const amount = round2(dto.amount);
    const money = await this.ledgerResolver.money({ mode: dto.paymentMode, bankAccountId: dto.bankAccountId });
    const fundLedgerId = c.ledgerId || (await this.ledgerResolver.fund(`${c.name} Fund`)).id;
    // Buying an asset: it goes on the books as a fixed asset, and the fund used moves to the capital reserve.
    const asset = dto.assetName ? await this.ledgerResolver.asset(dto.assetName) : null;
    const reserve = asset ? await this.ledgerResolver.system('CAPITAL_RESERVE') : null;

    const expense = await this.db.transaction(async (tx) => {
      await tx.select({ id: fundCampaigns.id }).from(fundCampaigns).where(eq(fundCampaigns.id, id)).for('update');
      const [p] = await tx.select(this.progressSql()).from(fundCampaigns).where(eq(fundCampaigns.id, id));
      const balance = round2(Number(p.collected) - Number(p.spent));
      if (amount > balance) throw new BadRequestException(`The fund holds only ${rupees(balance)}.`);
      const [v] = await tx
        .insert(vouchers)
        .values({
          societyId: this.societyId,
          voucherNumber: `VOU-FEX-${Date.now()}`,
          type: 'PAYMENT',
          date: dto.spentAt,
          narration: `${c.name}: ${dto.description}${dto.vendorName ? ` (${dto.vendorName})` : ''}${dto.billNumber ? `, bill ${dto.billNumber}` : ''}`,
        })
        .returning();
      const a = amount.toFixed(2);
      await tx.insert(transactions).values(
        asset && reserve
          ? [
              { societyId: this.societyId, voucherId: v.id, ledgerId: asset.id, type: 'DEBIT', amount: a },
              { societyId: this.societyId, voucherId: v.id, ledgerId: money.id, type: 'CREDIT', amount: a },
              { societyId: this.societyId, voucherId: v.id, ledgerId: fundLedgerId, type: 'DEBIT', amount: a },
              { societyId: this.societyId, voucherId: v.id, ledgerId: reserve.id, type: 'CREDIT', amount: a },
            ]
          : [
              { societyId: this.societyId, voucherId: v.id, ledgerId: fundLedgerId, type: 'DEBIT', amount: a },
              { societyId: this.societyId, voucherId: v.id, ledgerId: money.id, type: 'CREDIT', amount: a },
            ],
      );
      const { assetName, ...fields } = dto;
      const [row] = await tx
        .insert(fundExpenses)
        .values({ ...fields, amount: a, societyId: this.societyId, campaignId: id, bankAccountId: money.bankAccountId, voucherId: v.id, recordedBy: userId, assetLedgerId: asset?.id || null })
        .returning();
      return row;
    });
    await this.audit(userId, 'FUND_EXPENSE', expense.id, { campaignId: id, amount });
    return this.detail(id, userId);
  }

  async setStatus(id: string, status: 'ACTIVE' | 'CLOSED', userId: string) {
    await this.assertManager(userId);
    const c = await this.campaign(id);
    if (c.status === 'DRAFT') throw new ConflictException('Issue the shares to open the fund.');
    if (c.status === status) return this.detail(id, userId);
    await this.db
      .update(fundCampaigns)
      .set({ status, closedAt: status === 'CLOSED' ? new Date() : null, updatedAt: new Date() })
      .where(eq(fundCampaigns.id, id));
    await this.audit(userId, status === 'CLOSED' ? 'FUND_CLOSE' : 'FUND_REOPEN', id, null);
    return this.detail(id, userId);
  }

  // ---------------------------------------------------------------- helpers

  /** Sequential numbers per society and year (FND-2026-0001), serialised by an advisory lock. */
  private async nextNumber(tx: any, prefix: 'FND' | 'FCR', kind: 'invoice' | 'receipt') {
    const stem = `${prefix}-${yearIST()}-`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${this.societyId + prefix}))`);
    const rows = kind === 'invoice'
      ? await tx.select({ max: sql<string | null>`max(${fundShares.invoiceNumber})` }).from(fundShares).where(and(eq(fundShares.societyId, this.societyId), sql`${fundShares.invoiceNumber} like ${stem + '%'}`))
      : await tx.select({ max: sql<string | null>`max(${fundPayments.receiptNumber})` }).from(fundPayments).where(and(eq(fundPayments.societyId, this.societyId), sql`${fundPayments.receiptNumber} like ${stem + '%'}`));
    const start = (Number(rows[0]?.max?.slice(stem.length)) || 0) + 1;
    const make = (n: number) => ({ format: () => `${stem}${String(n).padStart(4, '0')}`, inc: () => make(n + 1) });
    return make(start);
  }

  private async residentsOf(flatId: string): Promise<string[]> {
    const rows = (await this.db.execute(sql`
      select o.user_id as "userId" from owners o join flat_owners fo on fo.owner_id = o.id and fo.is_current
      where fo.flat_id = ${flatId} and o.society_id = ${this.societyId}
      union
      select t.user_id from tenants t join flat_tenants ft on ft.tenant_id = t.id and ft.is_active
      where ft.flat_id = ${flatId} and ft.society_id = ${this.societyId}
    `)) as unknown as { userId: string }[];
    return rows.map((r) => r.userId);
  }

  private async tell(recipientUserId: string, title: string, body: string) {
    await this.notificationService.createInAppNotification({ societyId: this.societyId, recipientUserId, title, body });
  }

  private async audit(userId: string | undefined, action: string, entityId: string, newValues: any) {
    try {
      await this.db.insert(auditLogs).values({ societyId: this.societyId, userId: userId || null, action, entityName: 'funds', entityId, newValues } as any);
    } catch (err: any) {
      this.logger.warn(`Audit log failed: ${err?.message}`);
    }
  }
}
