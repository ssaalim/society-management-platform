import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import {
  members,
  users,
  flats,
  floors,
  wings,
  buildings,
  maintenanceBills,
  receipts,
  complaints,
  assets,
  vouchers,
  customReports,
  vehicles,
  staff,
  userSocieties,
  roles,
  permissions,
  rolePermissions,
  owners,
  flatOwners,
  tenants,
  flatTenants,
} from '../../../database/schema';
import { eq, and, or, ilike, isNull, inArray, sql } from 'drizzle-orm';

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  badge?: string;
  badgeColor?: string;
  url: string;
  icon: string;
  metadata?: Record<string, any>;
}

export interface SearchCategoryResult {
  category: string;
  icon: string;
  count: number;
  items: SearchResultItem[];
}

const MANAGEMENT_ROLES = [
  'SUPER_ADMIN',
  'PRESIDENT',
  'VICE_PRESIDENT',
  'SECRETARY',
  'JOINT_SECRETARY',
  'TREASURER',
  'ACCOUNTANT',
  'AUDITOR',
  'COMMITTEE_MEMBER',
  'ESTATE_MANAGER',
  'MAINTENANCE_INCHARGE',
  'SECURITY_SUPERVISOR',
  'CULTURAL_SECRETARY',
  'LEGAL_ADVISOR',
  'SOCIETY_ADMIN',
];

@Injectable()
export class SearchService {
  private readonly isDevAuth: boolean;

  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly cls: ClsService,
    private readonly configService: ConfigService,
  ) {
    this.isDevAuth = this.configService.get<string>('DEV_AUTH') === 'true';
  }

  private get activeTenantId(): string {
    const tenantId = this.cls.get<string>('tenantId');
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is missing. Please provide x-tenant-id.');
    }
    return tenantId;
  }

  async globalSearch(rawQuery: string, userId: string): Promise<{ categories: SearchCategoryResult[]; total: number }> {
    const q = (rawQuery || '').trim();
    if (!q || q.length < 1) {
      return { categories: [], total: 0 };
    }

    const tenantId = this.activeTenantId;
    const term = `%${q}%`;
    const LIMIT = 6;

    // ─────────────────────────────────────────────────────────────
    // 1. Resolve User Role & Permissions within the active society
    // ─────────────────────────────────────────────────────────────
    let isManagement = false;
    const userPermissions = new Set<string>();

    if (this.isDevAuth) {
      isManagement = true;
    } else {
      const userRoleRows = await this.db
        .select({ roleName: roles.name })
        .from(userSocieties)
        .innerJoin(roles, eq(userSocieties.roleId, roles.id))
        .where(
          and(
            eq(userSocieties.userId, userId),
            eq(userSocieties.societyId, tenantId)
          )
        );

      const roleNames = userRoleRows.map((r) => r.roleName);
      isManagement = roleNames.some((r) => MANAGEMENT_ROLES.includes(r));

      if (!isManagement) {
        const permRows = await this.db
          .select({ key: permissions.key })
          .from(userSocieties)
          .innerJoin(roles, eq(userSocieties.roleId, roles.id))
          .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
          .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
          .where(
            and(
              eq(userSocieties.userId, userId),
              eq(userSocieties.societyId, tenantId)
            )
          );

        permRows.forEach((p) => userPermissions.add(p.key));
      }
    }

    const hasPerm = (perm: string) => isManagement || userPermissions.has(perm);

    // ─────────────────────────────────────────────────────────────
    // 2. Resolve User Associated Flat IDs (For scoped resident data)
    // ─────────────────────────────────────────────────────────────
    let userFlatIds: string[] = [];
    if (!isManagement) {
      const [owned, rented] = await Promise.all([
        this.db
          .select({ flatId: flatOwners.flatId })
          .from(flatOwners)
          .innerJoin(owners, eq(flatOwners.ownerId, owners.id))
          .where(
            and(
              eq(owners.userId, userId),
              eq(owners.societyId, tenantId)
            )
          ),
        this.db
          .select({ flatId: flatTenants.flatId })
          .from(flatTenants)
          .innerJoin(tenants, eq(flatTenants.tenantId, tenants.id))
          .where(
            and(
              eq(tenants.userId, userId),
              eq(tenants.societyId, tenantId)
            )
          ),
      ]);

      const flatSet = new Set<string>();
      owned.forEach((o) => o.flatId && flatSet.add(o.flatId));
      rented.forEach((r) => r.flatId && flatSet.add(r.flatId));
      userFlatIds = Array.from(flatSet);
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Permission-Gated Queries
    // ─────────────────────────────────────────────────────────────

    // (A) Members: Requires 'member:read' or management role
    const canReadMembers = hasPerm('member:read');
    const memberQuery = canReadMembers
      ? this.db
          .select({
            id: members.id,
            membershipNumber: members.membershipNumber,
            memberType: members.memberType,
            status: members.status,
            userName: users.name,
            userEmail: users.email,
            userMobile: users.mobile,
          })
          .from(members)
          .innerJoin(users, eq(members.userId, users.id))
          .where(
            and(
              eq(members.societyId, tenantId),
              or(
                ilike(users.name, term),
                ilike(users.email, term),
                ilike(users.mobile, term),
                ilike(members.membershipNumber, term),
                ilike(members.memberType, term)
              )
            )
          )
          .limit(LIMIT)
      : Promise.resolve([]);

    // (B) Flats: 'flat:read' or own flats
    const canReadAnyFlat = hasPerm('flat:read');
    const flatFilter = canReadAnyFlat
      ? and(
          eq(flats.societyId, tenantId),
          isNull(flats.deletedAt),
          or(
            ilike(flats.number, term),
            ilike(flats.flatType, term),
            ilike(wings.name, term),
            ilike(buildings.name, term)
          )
        )
      : userFlatIds.length > 0
      ? and(
          eq(flats.societyId, tenantId),
          isNull(flats.deletedAt),
          inArray(flats.id, userFlatIds),
          or(
            ilike(flats.number, term),
            ilike(flats.flatType, term),
            ilike(wings.name, term),
            ilike(buildings.name, term)
          )
        )
      : null;

    const flatQuery = flatFilter
      ? this.db
          .select({
            id: flats.id,
            number: flats.number,
            flatType: flats.flatType,
            sqftArea: flats.sqftArea,
            wingName: wings.name,
            buildingName: buildings.name,
          })
          .from(flats)
          .leftJoin(floors, eq(flats.floorId, floors.id))
          .leftJoin(wings, eq(floors.wingId, wings.id))
          .leftJoin(buildings, eq(wings.buildingId, buildings.id))
          .where(flatFilter)
          .limit(LIMIT)
      : Promise.resolve([]);

    // (C) Maintenance Bills: 'billing:read' or own flats
    const canReadAnyBill = hasPerm('billing:read');
    const billFilter = canReadAnyBill
      ? and(
          eq(maintenanceBills.societyId, tenantId),
          or(
            ilike(maintenanceBills.billNumber, term),
            ilike(flats.number, term),
            ilike(maintenanceBills.status, term)
          )
        )
      : userFlatIds.length > 0
      ? and(
          eq(maintenanceBills.societyId, tenantId),
          inArray(maintenanceBills.flatId, userFlatIds),
          or(
            ilike(maintenanceBills.billNumber, term),
            ilike(flats.number, term),
            ilike(maintenanceBills.status, term)
          )
        )
      : null;

    const billQuery = billFilter
      ? this.db
          .select({
            id: maintenanceBills.id,
            billNumber: maintenanceBills.billNumber,
            totalAmount: maintenanceBills.totalAmount,
            status: maintenanceBills.status,
            dueDate: maintenanceBills.dueDate,
            flatNumber: flats.number,
          })
          .from(maintenanceBills)
          .leftJoin(flats, eq(maintenanceBills.flatId, flats.id))
          .where(billFilter)
          .limit(LIMIT)
      : Promise.resolve([]);

    // (D) Receipts: 'payment:read' or own bills
    const canReadAnyPayment = hasPerm('payment:read');
    const receiptFilter = canReadAnyPayment
      ? and(
          eq(receipts.societyId, tenantId),
          or(
            ilike(receipts.receiptNumber, term),
            ilike(receipts.referenceNumber, term),
            ilike(receipts.paymentMode, term),
            ilike(receipts.status, term)
          )
        )
      : userFlatIds.length > 0
      ? and(
          eq(receipts.societyId, tenantId),
          inArray(maintenanceBills.flatId, userFlatIds),
          or(
            ilike(receipts.receiptNumber, term),
            ilike(receipts.referenceNumber, term),
            ilike(receipts.paymentMode, term),
            ilike(receipts.status, term)
          )
        )
      : null;

    const receiptQuery = receiptFilter
      ? this.db
          .select({
            id: receipts.id,
            receiptNumber: receipts.receiptNumber,
            amountPaid: receipts.amountPaid,
            paymentMode: receipts.paymentMode,
            paymentDate: receipts.paymentDate,
            referenceNumber: receipts.referenceNumber,
            status: receipts.status,
          })
          .from(receipts)
          .leftJoin(maintenanceBills, eq(receipts.billId, maintenanceBills.id))
          .where(receiptFilter)
          .limit(LIMIT)
      : Promise.resolve([]);

    // (E) Complaints: 'complaint:read' or raised by user/from own flats
    const canReadAnyComplaint = hasPerm('complaint:read') || hasPerm('resident:read');
    const complaintFilter = isManagement || canReadAnyComplaint
      ? and(
          eq(complaints.societyId, tenantId),
          isNull(complaints.deletedAt),
          or(
            ilike(complaints.title, term),
            ilike(complaints.description, term),
            ilike(complaints.assignedStaffName, term),
            ilike(complaints.status, term),
            ilike(complaints.priority, term),
            ilike(flats.number, term)
          )
        )
      : and(
          eq(complaints.societyId, tenantId),
          isNull(complaints.deletedAt),
          or(
            eq(complaints.raisedByUserId, userId),
            userFlatIds.length > 0 ? inArray(complaints.flatId, userFlatIds) : sql`false`
          ),
          or(
            ilike(complaints.title, term),
            ilike(complaints.description, term),
            ilike(complaints.status, term),
            ilike(flats.number, term)
          )
        );

    const complaintQuery = this.db
      .select({
        id: complaints.id,
        title: complaints.title,
        status: complaints.status,
        priority: complaints.priority,
        assignedStaffName: complaints.assignedStaffName,
        flatNumber: flats.number,
      })
      .from(complaints)
      .leftJoin(flats, eq(complaints.flatId, flats.id))
      .where(complaintFilter)
      .limit(LIMIT);

    // (F) Assets: Requires 'asset:read' or management
    const canReadAssets = hasPerm('asset:read');
    const assetQuery = canReadAssets
      ? this.db
          .select({
            id: assets.id,
            name: assets.name,
            type: assets.type,
            amcProvider: assets.amcProvider,
            cost: assets.cost,
          })
          .from(assets)
          .where(
            and(
              eq(assets.societyId, tenantId),
              or(
                ilike(assets.name, term),
                ilike(assets.type, term),
                ilike(assets.amcProvider, term)
              )
            )
          )
          .limit(LIMIT)
      : Promise.resolve([]);

    // (G) Accounting Vouchers: Requires 'accounting:read' or management
    const canReadAccounting = hasPerm('accounting:read');
    const voucherQuery = canReadAccounting
      ? this.db
          .select({
            id: vouchers.id,
            voucherNumber: vouchers.voucherNumber,
            type: vouchers.type,
            narration: vouchers.narration,
            date: vouchers.date,
          })
          .from(vouchers)
          .where(
            and(
              eq(vouchers.societyId, tenantId),
              or(
                ilike(vouchers.voucherNumber, term),
                ilike(vouchers.narration, term),
                ilike(vouchers.type, term)
              )
            )
          )
          .limit(LIMIT)
      : Promise.resolve([]);

    // (H) Custom Reports: Requires 'report:read' or management
    const canReadReports = hasPerm('report:read');
    const customReportQuery = canReadReports
      ? this.db
          .select({
            id: customReports.id,
            name: customReports.name,
            description: customReports.description,
          })
          .from(customReports)
          .where(
            and(
              eq(customReports.societyId, tenantId),
              eq(customReports.isActive, true),
              isNull(customReports.deletedAt),
              or(
                ilike(customReports.name, term),
                ilike(customReports.description, term)
              )
            )
          )
          .limit(LIMIT)
      : Promise.resolve([]);

    // (I) Vehicles: 'flat:read' or own flats
    const canReadAnyVehicle = hasPerm('flat:read');
    const vehicleFilter = canReadAnyVehicle
      ? and(
          eq(vehicles.societyId, tenantId),
          or(
            ilike(vehicles.number, term),
            ilike(vehicles.make, term),
            ilike(vehicles.model, term),
            ilike(vehicles.type, term),
            ilike(flats.number, term)
          )
        )
      : userFlatIds.length > 0
      ? and(
          eq(vehicles.societyId, tenantId),
          inArray(vehicles.flatId, userFlatIds),
          or(
            ilike(vehicles.number, term),
            ilike(vehicles.make, term),
            ilike(vehicles.model, term),
            ilike(vehicles.type, term),
            ilike(flats.number, term)
          )
        )
      : null;

    const vehicleQuery = vehicleFilter
      ? this.db
          .select({
            id: vehicles.id,
            number: vehicles.number,
            type: vehicles.type,
            make: vehicles.make,
            model: vehicles.model,
            flatNumber: flats.number,
          })
          .from(vehicles)
          .leftJoin(flats, eq(vehicles.flatId, flats.id))
          .where(vehicleFilter)
          .limit(LIMIT)
      : Promise.resolve([]);

    // (J) Staff & Security: Requires 'resident:read' or management
    const canReadStaff = hasPerm('resident:read') || isManagement;
    const staffQuery = canReadStaff
      ? this.db
          .select({
            id: staff.id,
            name: staff.name,
            role: staff.role,
            mobile: staff.mobile,
            isAvailable: staff.isAvailable,
          })
          .from(staff)
          .where(
            and(
              eq(staff.societyId, tenantId),
              or(
                ilike(staff.name, term),
                ilike(staff.role, term),
                ilike(staff.mobile, term)
              )
            )
          )
          .limit(LIMIT)
      : Promise.resolve([]);

    // Execute all permissible queries in parallel
    const [
      memberRows,
      flatRows,
      billRows,
      receiptRows,
      complaintRows,
      assetRows,
      voucherRows,
      customReportRows,
      vehicleRows,
      staffRows,
    ] = await Promise.all([
      memberQuery,
      flatQuery,
      billQuery,
      receiptQuery,
      complaintQuery,
      assetQuery,
      voucherQuery,
      customReportQuery,
      vehicleQuery,
      staffQuery,
    ]);

    const categories: SearchCategoryResult[] = [];

    // Map Members
    if (memberRows.length > 0) {
      categories.push({
        category: 'Members & Residents',
        icon: 'Users',
        count: memberRows.length,
        items: memberRows.map((m) => ({
          id: m.id,
          title: m.userName || 'Member',
          subtitle: `${m.membershipNumber} • ${m.userMobile || m.userEmail || ''}`,
          type: 'member',
          badge: m.memberType,
          badgeColor: m.status === 'ACTIVE' ? 'emerald' : 'slate',
          url: `/members/${m.id}`,
          icon: 'User',
        })),
      });
    }

    // Map Flats
    if (flatRows.length > 0) {
      categories.push({
        category: 'Flats & Units',
        icon: 'Home',
        count: flatRows.length,
        items: flatRows.map((f) => ({
          id: f.id,
          title: `Flat ${f.number}`,
          subtitle: `${f.wingName ? `Wing ${f.wingName}` : ''}${f.buildingName ? ` • ${f.buildingName}` : ''} • ${f.flatType || ''}`,
          type: 'flat',
          badge: f.flatType,
          badgeColor: 'indigo',
          url: `/flats/${f.id}`,
          icon: 'Home',
        })),
      });
    }

    // Map Maintenance Bills
    if (billRows.length > 0) {
      categories.push({
        category: 'Maintenance Invoices',
        icon: 'Receipt',
        count: billRows.length,
        items: billRows.map((b) => ({
          id: b.id,
          title: `Invoice #${b.billNumber}`,
          subtitle: `Flat ${b.flatNumber || 'N/A'} • ₹${Number(b.totalAmount).toLocaleString('en-IN')} • Due: ${b.dueDate}`,
          type: 'maintenance',
          badge: b.status,
          badgeColor: b.status === 'PAID' ? 'emerald' : b.status === 'OVERDUE' ? 'rose' : 'amber',
          url: isManagement || canReadAnyBill ? `/maintenance` : `/resident`,
          icon: 'Receipt',
        })),
      });
    }

    // Map Receipts
    if (receiptRows.length > 0) {
      categories.push({
        category: 'Payments & Receipts',
        icon: 'CreditCard',
        count: receiptRows.length,
        items: receiptRows.map((r) => ({
          id: r.id,
          title: `Receipt #${r.receiptNumber}`,
          subtitle: `₹${Number(r.amountPaid).toLocaleString('en-IN')} via ${r.paymentMode} • ${r.paymentDate}${r.referenceNumber ? ` (${r.referenceNumber})` : ''}`,
          type: 'payment',
          badge: r.status,
          badgeColor: r.status === 'CLEARED' ? 'emerald' : 'amber',
          url: isManagement || canReadAnyPayment ? `/payments` : `/resident`,
          icon: 'CreditCard',
        })),
      });
    }

    // Map Complaints
    if (complaintRows.length > 0) {
      categories.push({
        category: 'Complaints & Tickets',
        icon: 'MessageSquare',
        count: complaintRows.length,
        items: complaintRows.map((c) => ({
          id: c.id,
          title: c.title,
          subtitle: `Flat ${c.flatNumber || 'N/A'}${c.assignedStaffName ? ` • Assigned to ${c.assignedStaffName}` : ' • Unassigned'}`,
          type: 'complaint',
          badge: `${c.status} (${c.priority})`,
          badgeColor: c.status === 'RESOLVED' ? 'emerald' : c.priority === 'HIGH' || c.priority === 'URGENT' ? 'rose' : 'amber',
          url: `/complaints`,
          icon: 'MessageSquare',
        })),
      });
    }

    // Map Assets
    if (assetRows.length > 0) {
      categories.push({
        category: 'Assets & Equipment',
        icon: 'Box',
        count: assetRows.length,
        items: assetRows.map((a) => ({
          id: a.id,
          title: a.name,
          subtitle: `${a.type || 'Asset'}${a.amcProvider ? ` • AMC: ${a.amcProvider}` : ''}${a.cost ? ` • ₹${Number(a.cost).toLocaleString('en-IN')}` : ''}`,
          type: 'asset',
          badge: a.type || 'Asset',
          badgeColor: 'cyan',
          url: `/assets`,
          icon: 'Box',
        })),
      });
    }

    // Map Accounting Vouchers
    if (voucherRows.length > 0) {
      categories.push({
        category: 'Accounting Vouchers',
        icon: 'BookOpen',
        count: voucherRows.length,
        items: voucherRows.map((v) => ({
          id: v.id,
          title: `Voucher #${v.voucherNumber} (${v.type})`,
          subtitle: `${v.narration || 'No narration'} • Date: ${v.date}`,
          type: 'accounting',
          badge: v.type,
          badgeColor: 'violet',
          url: `/accounting`,
          icon: 'BookOpen',
        })),
      });
    }

    // Map Custom SQL Reports
    if (customReportRows.length > 0) {
      categories.push({
        category: 'Custom Reports',
        icon: 'Code2',
        count: customReportRows.length,
        items: customReportRows.map((cr) => ({
          id: cr.id,
          title: cr.name,
          subtitle: cr.description || 'Custom SQL parametrized report',
          type: 'custom-report',
          badge: 'SQL Report',
          badgeColor: 'indigo',
          url: `/reports/custom`,
          icon: 'Code2',
        })),
      });
    }

    // Map Vehicles
    if (vehicleRows.length > 0) {
      categories.push({
        category: 'Registered Vehicles',
        icon: 'ShieldCheck',
        count: vehicleRows.length,
        items: vehicleRows.map((vh) => ({
          id: vh.id,
          title: vh.number,
          subtitle: `${vh.make || ''} ${vh.model || ''} (${vh.type})${vh.flatNumber ? ` • Flat ${vh.flatNumber}` : ''}`,
          type: 'vehicle',
          badge: vh.type,
          badgeColor: 'blue',
          url: isManagement || canReadAnyFlat ? `/flats` : `/resident`,
          icon: 'ShieldCheck',
        })),
      });
    }

    // Map Staff
    if (staffRows.length > 0) {
      categories.push({
        category: 'Staff & Security',
        icon: 'UserCheck',
        count: staffRows.length,
        items: staffRows.map((st) => ({
          id: st.id,
          title: st.name,
          subtitle: `${st.role} • ${st.mobile || 'No contact'}`,
          type: 'staff',
          badge: st.isAvailable ? 'Available' : 'Off Duty',
          badgeColor: st.isAvailable ? 'emerald' : 'slate',
          url: `/dashboard`,
          icon: 'UserCheck',
        })),
      });
    }

    const total = categories.reduce((sum, cat) => sum + cat.count, 0);
    return { categories, total };
  }
}
