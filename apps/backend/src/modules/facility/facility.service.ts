import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { and, asc, desc, eq, gt, inArray, lt, ne, or, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { LedgerResolver } from '@core/accounting/ledger-resolver.service';
import {
  auditLogs,
  flatOwners,
  flatTenants,
  flats,
  floors,
  owners,
  roles,
  serviceCharges,
  serviceRequests,
  tenants,
  transactions,
  userSocieties,
  users,
  vouchers,
  wings,
} from '../../../database/schema';
import { NotificationService } from '../notification/notification.service';
import { PaymentDto, RefundDto, ServiceChargeDto, ServiceRequestDto } from './dto/facility.dto';

type Charge = typeof serviceCharges.$inferSelect;
type Request = typeof serviceRequests.$inferSelect;

const RESIDENT_ROLES = ['OWNER', 'CO_OWNER', 'TENANT', 'FAMILY_MEMBER', 'MEMBER'];
/** Who hears about new requests. */
const OFFICE_ROLES = ['PRESIDENT', 'SECRETARY', 'TREASURER', 'ACCOUNTANT', 'ESTATE_MANAGER', 'SOCIETY_ADMIN'];
/** Requests that hold a booking slot. */
const HOLDING = ['REQUESTED', 'APPROVED', 'COMPLETED'];
const HOUR = 60 * 60 * 1000;

const round2 = (n: number) => Math.round(n * 100) / 100;
const yearIST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric' }).format(new Date());
const fmtWhen = (d: Date) =>
  d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

interface Actor {
  userId: string;
  role: string;
  isResident: boolean;
  /** Flats the user owns or rents in this society (residents only). */
  flatIds: string[];
}

/**
 * Facility & service charges: the society's catalogue (hall booking, flat transfer fee, lift use for shifting) and the
 * requests against it: request → approval (invoice number) → payment (receipt and voucher) → deposit refund.
 */
@Injectable()
export class FacilityService {
  private readonly logger = new Logger(FacilityService.name);

  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly cls: ClsService,
    private readonly ledgerResolver: LedgerResolver,
    private readonly notificationService: NotificationService,
  ) {}

  private get societyId(): string {
    const id = this.cls.get<string>('tenantId');
    if (!id) throw new BadRequestException('Society context is missing.');
    return id;
  }

  private async actor(userId: string): Promise<Actor> {
    const societyId = this.societyId;
    const [membership] = await this.db
      .select({ role: roles.name })
      .from(userSocieties)
      .innerJoin(roles, eq(roles.id, userSocieties.roleId))
      .where(and(eq(userSocieties.userId, userId), eq(userSocieties.societyId, societyId)));
    const role = membership?.role || '';
    const isResident = !role || RESIDENT_ROLES.includes(role);
    if (!isResident) return { userId, role, isResident, flatIds: [] };

    const owned = await this.db
      .select({ flatId: flatOwners.flatId })
      .from(flatOwners)
      .innerJoin(owners, eq(owners.id, flatOwners.ownerId))
      .where(and(eq(owners.userId, userId), eq(owners.societyId, societyId), eq(flatOwners.isCurrent, true)));
    const rented = await this.db
      .select({ flatId: flatTenants.flatId })
      .from(flatTenants)
      .innerJoin(tenants, eq(tenants.id, flatTenants.tenantId))
      .where(and(eq(tenants.userId, userId), eq(flatTenants.societyId, societyId), eq(flatTenants.isActive, true)));
    return { userId, role, isResident, flatIds: [...new Set([...owned, ...rented].map((r) => r.flatId))] };
  }

  /** Office-only actions: checked here too, so they never depend on the route guard alone. */
  private async assertOffice(userId: string) {
    const me = await this.actor(userId);
    if (me.isResident) throw new ForbiddenException('Only the society office can do this.');
    return me;
  }

  // ---------------------------------------------------------------- catalogue

  async listCharges(userId: string) {
    const me = await this.actor(userId);
    const rows = await this.db
      .select()
      .from(serviceCharges)
      .where(eq(serviceCharges.societyId, this.societyId))
      .orderBy(desc(serviceCharges.isActive), asc(serviceCharges.name));
    return me.isResident ? rows.filter((c) => c.isActive && c.residentCanRequest) : rows;
  }

  private async getCharge(id: string): Promise<Charge> {
    const [row] = await this.db
      .select()
      .from(serviceCharges)
      .where(and(eq(serviceCharges.id, id), eq(serviceCharges.societyId, this.societyId)));
    if (!row) throw new NotFoundException('Facility or service not found.');
    return row;
  }

  private chargeRow(dto: ServiceChargeDto) {
    return {
      name: dto.name,
      description: dto.description,
      kind: dto.kind,
      pricing: dto.pricing,
      rate: dto.rate.toFixed(2),
      depositAmount: dto.depositAmount.toFixed(2),
      gstRate: dto.gstRate.toFixed(2),
      requiresApproval: dto.requiresApproval,
      residentCanRequest: dto.residentCanRequest,
      isActive: dto.isActive,
      updatedAt: new Date(),
    };
  }

  async createCharge(dto: ServiceChargeDto, userId: string) {
    await this.assertOffice(userId);
    // Each facility gets its own income account, e.g. "Clubhouse Hall Booking Income".
    const income = await this.ledgerResolver.income(`${dto.name} Income`);
    const [row] = await this.db
      .insert(serviceCharges)
      .values({ ...this.chargeRow(dto), societyId: this.societyId, incomeLedgerId: income.id })
      .returning();
    await this.audit(userId, 'SERVICE_CHARGE_CREATE', 'service_charges', row.id, row);
    return row;
  }

  async updateCharge(id: string, dto: ServiceChargeDto, userId: string) {
    await this.assertOffice(userId);
    const current = await this.getCharge(id);
    const incomeLedgerId = current.incomeLedgerId || (await this.ledgerResolver.income(`${dto.name} Income`)).id;
    const [row] = await this.db
      .update(serviceCharges)
      .set({ ...this.chargeRow(dto), incomeLedgerId })
      .where(and(eq(serviceCharges.id, id), eq(serviceCharges.societyId, this.societyId)))
      .returning();
    await this.audit(userId, 'SERVICE_CHARGE_UPDATE', 'service_charges', id, row);
    return row;
  }

  /** Deletes an unused item; one with requests is switched off instead so its history stays. */
  async removeCharge(id: string, userId: string) {
    await this.assertOffice(userId);
    await this.getCharge(id);
    const [{ n }] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(serviceRequests)
      .where(eq(serviceRequests.chargeId, id));
    if (n > 0) {
      await this.db.update(serviceCharges).set({ isActive: false, updatedAt: new Date() }).where(eq(serviceCharges.id, id));
      await this.audit(userId, 'SERVICE_CHARGE_DEACTIVATE', 'service_charges', id, null);
      return { deleted: false, deactivated: true };
    }
    await this.db.delete(serviceCharges).where(eq(serviceCharges.id, id));
    await this.audit(userId, 'SERVICE_CHARGE_DELETE', 'service_charges', id, null);
    return { deleted: true, deactivated: false };
  }

  /** Busy slots of a bookable facility between two moments (no personal details, so residents can see them). */
  async bookings(chargeId: string, from: string, to: string) {
    await this.getCharge(chargeId);
    const start = new Date(from);
    const end = new Date(to);
    if (isNaN(+start) || isNaN(+end)) throw new BadRequestException('Give a valid date range.');
    return this.db
      .select({ startAt: serviceRequests.startAt, endAt: serviceRequests.endAt, status: serviceRequests.status })
      .from(serviceRequests)
      .where(
        and(
          eq(serviceRequests.chargeId, chargeId),
          eq(serviceRequests.societyId, this.societyId),
          inArray(serviceRequests.status, HOLDING),
          lt(serviceRequests.startAt, end),
          gt(serviceRequests.endAt, start),
        ),
      )
      .orderBy(asc(serviceRequests.startAt));
  }

  // ---------------------------------------------------------------- requests

  private requestColumns() {
    return {
      request: serviceRequests,
      chargeName: serviceCharges.name,
      chargeKind: serviceCharges.kind,
      pricing: serviceCharges.pricing,
      flatNumber: flats.number,
      wingName: wings.name,
      requesterName: users.name,
    };
  }

  private shape(r: any) {
    return {
      ...r.request,
      chargeName: r.chargeName,
      chargeKind: r.chargeKind,
      pricing: r.pricing,
      flatLabel: r.wingName ? `${r.wingName}-${r.flatNumber}` : r.flatNumber,
      requesterName: r.requesterName,
    };
  }

  private requestQuery() {
    return this.db
      .select(this.requestColumns())
      .from(serviceRequests)
      .innerJoin(serviceCharges, eq(serviceCharges.id, serviceRequests.chargeId))
      .innerJoin(flats, eq(flats.id, serviceRequests.flatId))
      .leftJoin(floors, eq(floors.id, flats.floorId))
      .leftJoin(wings, eq(wings.id, floors.wingId))
      .leftJoin(users, eq(users.id, serviceRequests.requestedBy));
  }

  /** Office: every request (optionally by status). Residents: their flats' requests and their own. */
  async listRequests(userId: string, status?: string) {
    const me = await this.actor(userId);
    const where = [eq(serviceRequests.societyId, this.societyId)];
    if (status) where.push(eq(serviceRequests.status, status));
    if (me.isResident) {
      where.push(
        me.flatIds.length
          ? or(eq(serviceRequests.requestedBy, userId), inArray(serviceRequests.flatId, me.flatIds))!
          : eq(serviceRequests.requestedBy, userId),
      );
    }
    const rows = await this.requestQuery()
      .where(and(...where))
      .orderBy(desc(serviceRequests.createdAt))
      .limit(500);
    return rows.map((r) => this.shape(r));
  }

  async getRequest(id: string, userId?: string) {
    const [row] = await this.requestQuery().where(and(eq(serviceRequests.id, id), eq(serviceRequests.societyId, this.societyId)));
    if (!row) throw new NotFoundException('Request not found.');
    if (userId) {
      const me = await this.actor(userId);
      if (me.isResident && row.request.requestedBy !== userId && !me.flatIds.includes(row.request.flatId)) {
        throw new NotFoundException('Request not found.');
      }
    }
    return this.shape(row);
  }

  /** Hours (rounded up) or days (rounded up, 24 h each) for timed pricing; 1 for a fixed price. */
  private quantityFor(charge: Charge, start: Date | null, end: Date | null): number {
    if (charge.pricing === 'FIXED') return 1;
    if (!start || !end) throw new BadRequestException('Choose the start and end time.');
    const hours = (end.getTime() - start.getTime()) / HOUR;
    return charge.pricing === 'PER_HOUR' ? Math.ceil(hours) : Math.ceil(hours / 24);
  }

  async createRequest(dto: ServiceRequestDto, userId: string) {
    const societyId = this.societyId;
    const me = await this.actor(userId);
    const charge = await this.getCharge(dto.chargeId);
    if (!charge.isActive) throw new BadRequestException(`${charge.name} is not available right now.`);

    let flatId = dto.flatId;
    if (me.isResident) {
      if (!charge.residentCanRequest) throw new ForbiddenException(`Please ask the society office for ${charge.name}.`);
      if (!me.flatIds.length) throw new BadRequestException('Your account is not linked to a flat yet. Please contact the office.');
      if (flatId && !me.flatIds.includes(flatId)) throw new ForbiddenException('You can only request for your own flat.');
      flatId = flatId || me.flatIds[0];
    } else if (!flatId) {
      throw new BadRequestException('Choose the flat this is for.');
    }
    const [flat] = await this.db
      .select({ id: flats.id })
      .from(flats)
      .where(and(eq(flats.id, flatId!), eq(flats.societyId, societyId)));
    if (!flat) throw new BadRequestException('That flat is not part of this society.');

    const start = dto.startAt ? new Date(dto.startAt) : null;
    const end = dto.endAt ? new Date(dto.endAt) : null;
    if (charge.kind === 'BOOKING' && (!start || !end)) throw new BadRequestException('Choose when you need it.');
    if (start && me.isResident && start.getTime() < Date.now() - HOUR) throw new BadRequestException('Choose a time in the future.');
    const quantity = this.quantityFor(charge, start, end);

    const chargeAmount = round2(Number(charge.rate) * quantity);
    const gstAmount = round2((chargeAmount * Number(charge.gstRate)) / 100);
    const depositAmount = round2(Number(charge.depositAmount));
    const autoApprove = !charge.requiresApproval;

    const row = await this.db.transaction(async (tx) => {
      // One booking at a time per facility, so two people can't take the same slot.
      await tx.select({ id: serviceCharges.id }).from(serviceCharges).where(eq(serviceCharges.id, charge.id)).for('update');
      if (charge.kind === 'BOOKING' && start && end) {
        const [clash] = await tx
          .select({ startAt: serviceRequests.startAt, endAt: serviceRequests.endAt })
          .from(serviceRequests)
          .where(
            and(
              eq(serviceRequests.chargeId, charge.id),
              inArray(serviceRequests.status, HOLDING),
              lt(serviceRequests.startAt, end),
              gt(serviceRequests.endAt, start),
            ),
          )
          .limit(1);
        if (clash) {
          throw new ConflictException(
            `${charge.name} is already booked from ${fmtWhen(clash.startAt!)} to ${fmtWhen(clash.endAt!)}. Please choose another time.`,
          );
        }
      }
      const [created] = await tx
        .insert(serviceRequests)
        .values({
          societyId,
          chargeId: charge.id,
          flatId: flatId!,
          requestedBy: userId,
          startAt: start,
          endAt: end,
          quantity: quantity.toFixed(2),
          purpose: dto.purpose,
          status: autoApprove ? 'APPROVED' : 'REQUESTED',
          chargeAmount: chargeAmount.toFixed(2),
          gstAmount: gstAmount.toFixed(2),
          depositAmount: depositAmount.toFixed(2),
          totalAmount: (chargeAmount + gstAmount + depositAmount).toFixed(2),
          invoiceNumber: autoApprove ? await this.nextNumber(tx, 'FAC', serviceRequests.invoiceNumber) : null,
          decidedAt: autoApprove ? new Date() : null,
        })
        .returning();
      return created;
    });

    await this.audit(userId, 'SERVICE_REQUEST_CREATE', 'service_requests', row.id, row);
    const result = await this.getRequest(row.id);
    if (me.isResident) {
      await this.notificationService.notifyRoles(
        OFFICE_ROLES,
        autoApprove ? `${charge.name} booked` : `New request: ${charge.name}`,
        `${result.flatLabel}${start ? `, ${fmtWhen(start)}` : ''}. ${autoApprove ? 'Payment is due.' : 'Open Facilities to approve or reject it.'}`,
      );
    }
    return result;
  }

  /** Next document number for this society and year, e.g. FAC-2026-0007. Serialised by an advisory lock. */
  private async nextNumber(tx: any, prefix: string, column: typeof serviceRequests.invoiceNumber | typeof serviceRequests.receiptNumber) {
    const societyId = this.societyId;
    const stem = `${prefix}-${yearIST()}-`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${societyId + prefix}))`);
    const [{ max }] = await tx
      .select({ max: sql<string | null>`max(${column})` })
      .from(serviceRequests)
      .where(and(eq(serviceRequests.societyId, societyId), sql`${column} like ${stem + '%'}`));
    const next = (Number(max?.slice(stem.length)) || 0) + 1;
    return `${stem}${String(next).padStart(4, '0')}`;
  }

  private async load(id: string): Promise<Request> {
    const [row] = await this.db
      .select()
      .from(serviceRequests)
      .where(and(eq(serviceRequests.id, id), eq(serviceRequests.societyId, this.societyId)));
    if (!row) throw new NotFoundException('Request not found.');
    return row;
  }

  async approve(id: string, note: string | null, userId: string) {
    await this.assertOffice(userId);
    const req = await this.load(id);
    if (req.status !== 'REQUESTED') throw new ConflictException('Only requests waiting for approval can be approved.');
    await this.db.transaction(async (tx) => {
      const [locked] = await tx.select({ status: serviceRequests.status }).from(serviceRequests).where(eq(serviceRequests.id, id)).for('update');
      if (locked?.status !== 'REQUESTED') throw new ConflictException('Only requests waiting for approval can be approved.');
      await tx
        .update(serviceRequests)
        .set({
          status: 'APPROVED',
          invoiceNumber: await this.nextNumber(tx, 'FAC', serviceRequests.invoiceNumber),
          decidedBy: userId,
          decidedAt: new Date(),
          decisionNote: note,
          updatedAt: new Date(),
        })
        .where(eq(serviceRequests.id, id));
    });
    await this.audit(userId, 'SERVICE_REQUEST_APPROVE', 'service_requests', id, { note });
    const result = await this.getRequest(id);
    const due = Number(result.totalAmount);
    await this.tell(req.requestedBy, `${result.chargeName} approved`, `Invoice ${result.invoiceNumber}${due > 0 ? `: ₹${due.toLocaleString('en-IN')} payable to the society office` : ''}.${note ? ` ${note}` : ''}`);
    return result;
  }

  async reject(id: string, note: string | null, userId: string) {
    await this.assertOffice(userId);
    const [row] = await this.db
      .update(serviceRequests)
      .set({ status: 'REJECTED', decidedBy: userId, decidedAt: new Date(), decisionNote: note, updatedAt: new Date() })
      .where(and(eq(serviceRequests.id, id), eq(serviceRequests.societyId, this.societyId), eq(serviceRequests.status, 'REQUESTED')))
      .returning();
    if (!row) throw new ConflictException('Only requests waiting for approval can be rejected.');
    await this.audit(userId, 'SERVICE_REQUEST_REJECT', 'service_requests', id, { note });
    const result = await this.getRequest(id);
    await this.tell(row.requestedBy, `${result.chargeName} not approved`, note || 'Please contact the society office for details.');
    return result;
  }

  /** The requester (or the office) withdraws a request before it is paid. */
  async cancel(id: string, userId: string) {
    const req = await this.getRequest(id, userId);
    const me = await this.actor(userId);
    if (me.isResident && req.requestedBy !== userId) throw new ForbiddenException('Only the person who asked can cancel this request.');
    if (!['REQUESTED', 'APPROVED'].includes(req.status) || req.paymentStatus === 'PAID') {
      throw new ConflictException('Paid or finished requests cannot be cancelled. Please contact the society office.');
    }
    await this.db
      .update(serviceRequests)
      .set({ status: 'CANCELLED', updatedAt: new Date() })
      .where(and(eq(serviceRequests.id, id), eq(serviceRequests.paymentStatus, 'UNPAID')));
    await this.audit(userId, 'SERVICE_REQUEST_CANCEL', 'service_requests', id, null);
    return this.getRequest(id);
  }

  async complete(id: string, userId: string) {
    await this.assertOffice(userId);
    const [row] = await this.db
      .update(serviceRequests)
      .set({ status: 'COMPLETED', updatedAt: new Date() })
      .where(and(eq(serviceRequests.id, id), eq(serviceRequests.societyId, this.societyId), eq(serviceRequests.status, 'APPROVED')))
      .returning();
    if (!row) throw new ConflictException('Only approved requests can be marked done.');
    await this.audit(userId, 'SERVICE_REQUEST_COMPLETE', 'service_requests', id, null);
    return this.getRequest(id);
  }

  /**
   * Records payment and posts the receipt voucher: debit cash/bank for the total; credit the facility's income, GST
   * output and refundable deposits.
   */
  async recordPayment(id: string, dto: PaymentDto, userId: string) {
    await this.assertOffice(userId);
    const societyId = this.societyId;
    const req = await this.load(id);
    if (!['APPROVED', 'COMPLETED'].includes(req.status)) throw new ConflictException('Approve the request before recording payment.');
    if (req.paymentStatus === 'PAID') throw new ConflictException('Payment has already been recorded.');
    const charge = await this.getCharge(req.chargeId);

    const total = Number(req.totalAmount);
    const money = await this.ledgerResolver.money({ mode: dto.paymentMode, bankAccountId: dto.bankAccountId });
    const income = charge.incomeLedgerId ? { id: charge.incomeLedgerId } : await this.ledgerResolver.income(`${charge.name} Income`);
    const gst = Number(req.gstAmount) > 0 ? await this.ledgerResolver.system('GST_OUTPUT') : null;
    const deposits = Number(req.depositAmount) > 0 ? await this.ledgerResolver.system('DEPOSITS') : null;

    await this.db.transaction(async (tx) => {
      const [locked] = await tx.select({ paymentStatus: serviceRequests.paymentStatus }).from(serviceRequests).where(eq(serviceRequests.id, id)).for('update');
      if (locked?.paymentStatus === 'PAID') throw new ConflictException('Payment has already been recorded.');
      const receiptNumber = await this.nextNumber(tx, 'FRC', serviceRequests.receiptNumber);

      let voucherId: string | null = null;
      if (total > 0) {
        const [v] = await tx
          .insert(vouchers)
          .values({
            societyId,
            voucherNumber: `VOU-${receiptNumber}`,
            type: 'RECEIPT',
            date: dto.paidAt,
            narration: `${charge.name}, invoice ${req.invoiceNumber}${dto.reference ? `, ref ${dto.reference}` : ''}`,
          })
          .returning();
        voucherId = v.id;
        const lines = [
          { societyId, voucherId: v.id, ledgerId: money.id, type: 'DEBIT', amount: total.toFixed(2) },
          { societyId, voucherId: v.id, ledgerId: income.id, type: 'CREDIT', amount: req.chargeAmount },
        ];
        if (gst) lines.push({ societyId, voucherId: v.id, ledgerId: gst.id, type: 'CREDIT', amount: req.gstAmount });
        if (deposits) lines.push({ societyId, voucherId: v.id, ledgerId: deposits.id, type: 'CREDIT', amount: req.depositAmount });
        await tx.insert(transactions).values(lines.filter((l) => Number(l.amount) > 0));
      }
      await tx
        .update(serviceRequests)
        .set({
          paymentStatus: 'PAID',
          receiptNumber,
          paidAt: dto.paidAt,
          paymentMode: dto.paymentMode,
          bankAccountId: money.bankAccountId,
          paymentReference: dto.reference,
          paymentVoucherId: voucherId,
          depositStatus: deposits ? 'HELD' : 'NONE',
          updatedAt: new Date(),
        })
        .where(eq(serviceRequests.id, id));
    });
    await this.audit(userId, 'SERVICE_REQUEST_PAYMENT', 'service_requests', id, dto);
    const result = await this.getRequest(id);
    await this.tell(req.requestedBy, `Payment received: ${charge.name}`, `Receipt ${result.receiptNumber} for ₹${total.toLocaleString('en-IN')}.`);
    return result;
  }

  /**
   * Refunds the deposit (recorded by the office; nothing is paid out automatically). Debit deposits held; credit cash/bank
   * for the amount returned and the facility's income for any part kept (damages).
   */
  async refundDeposit(id: string, dto: RefundDto, userId: string) {
    await this.assertOffice(userId);
    const societyId = this.societyId;
    const req = await this.load(id);
    if (req.depositStatus !== 'HELD') throw new ConflictException('There is no deposit held for this request.');
    const deposit = Number(req.depositAmount);
    const refund = round2(dto.refundAmount);
    if (refund > deposit) throw new BadRequestException(`The refund can't be more than the deposit (₹${deposit.toLocaleString('en-IN')}).`);
    const kept = round2(deposit - refund);
    if (kept > 0 && !dto.note) throw new BadRequestException('Say why part of the deposit is kept.');
    const charge = await this.getCharge(req.chargeId);

    const deposits = await this.ledgerResolver.system('DEPOSITS');
    const money = refund > 0 ? await this.ledgerResolver.money({ mode: dto.paymentMode, bankAccountId: dto.bankAccountId }) : null;
    const income = charge.incomeLedgerId ? { id: charge.incomeLedgerId } : await this.ledgerResolver.income(`${charge.name} Income`);

    await this.db.transaction(async (tx) => {
      const [locked] = await tx.select({ depositStatus: serviceRequests.depositStatus }).from(serviceRequests).where(eq(serviceRequests.id, id)).for('update');
      if (locked?.depositStatus !== 'HELD') throw new ConflictException('There is no deposit held for this request.');
      const [v] = await tx
        .insert(vouchers)
        .values({
          societyId,
          voucherNumber: `VOU-DEP-${req.receiptNumber || randomUUID().slice(0, 8)}`,
          type: refund > 0 ? 'PAYMENT' : 'JOURNAL',
          date: dto.refundedAt,
          narration: `Deposit refund, ${charge.name} (${req.invoiceNumber})${kept > 0 ? `; ₹${kept} kept: ${dto.note}` : ''}`,
        })
        .returning();
      const lines = [{ societyId, voucherId: v.id, ledgerId: deposits.id, type: 'DEBIT', amount: deposit.toFixed(2) }];
      if (money) lines.push({ societyId, voucherId: v.id, ledgerId: money.id, type: 'CREDIT', amount: refund.toFixed(2) });
      if (kept > 0) lines.push({ societyId, voucherId: v.id, ledgerId: income.id, type: 'CREDIT', amount: kept.toFixed(2) });
      await tx.insert(transactions).values(lines);
      await tx
        .update(serviceRequests)
        .set({
          depositStatus: 'REFUNDED',
          depositRefunded: refund.toFixed(2),
          depositRefundedAt: dto.refundedAt,
          depositNote: dto.note,
          refundVoucherId: v.id,
          updatedAt: new Date(),
        })
        .where(eq(serviceRequests.id, id));
    });
    await this.audit(userId, 'SERVICE_REQUEST_DEPOSIT_REFUND', 'service_requests', id, dto);
    const result = await this.getRequest(id);
    await this.tell(
      req.requestedBy,
      `Deposit refunded: ${charge.name}`,
      `₹${refund.toLocaleString('en-IN')} refunded${kept > 0 ? `; ₹${kept.toLocaleString('en-IN')} kept (${dto.note})` : ''}.`,
    );
    return result;
  }

  /** Counts for the office's badges. */
  async summary(userId: string) {
    await this.assertOffice(userId);
    const rows = await this.db
      .select({
        pending: sql<number>`count(*) filter (where ${serviceRequests.status} = 'REQUESTED')::int`,
        unpaid: sql<number>`count(*) filter (where ${serviceRequests.status} in ('APPROVED','COMPLETED') and ${serviceRequests.paymentStatus} = 'UNPAID' and ${serviceRequests.totalAmount} > 0)::int`,
        depositsHeld: sql<number>`count(*) filter (where ${serviceRequests.depositStatus} = 'HELD')::int`,
      })
      .from(serviceRequests)
      .where(and(eq(serviceRequests.societyId, this.societyId), ne(serviceRequests.status, 'CANCELLED')));
    return rows[0];
  }

  private async tell(userId: string | null, title: string, body: string) {
    if (!userId) return;
    await this.notificationService.createInAppNotification({ societyId: this.societyId, recipientUserId: userId, title, body });
  }

  private async audit(userId: string | undefined, action: string, entityName: string, entityId: string, newValues: any) {
    try {
      await this.db.insert(auditLogs).values({ societyId: this.societyId, userId: userId || null, action, entityName, entityId, newValues } as any);
    } catch (err: any) {
      this.logger.warn(`Audit log failed: ${err?.message}`);
    }
  }
}
