import { 
  pgTable, 
  uuid, 
  varchar, 
  timestamp, 
  jsonb, 
  text, 
  primaryKey, 
  integer, 
  boolean, 
  numeric, 
  date, 
  index, 
  pgEnum 
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ==========================================
// 1. GLOBAL & IDENTITY MANAGEMENT
// ==========================================

// Societies (Tenants)
export const societies = pgTable('societies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  address: text('address'),
  gstin: varchar('gstin', { length: 15 }),
  pan: varchar('pan', { length: 10 }),
  tan: varchar('tan', { length: 10 }),
  registrationNumber: varchar('registration_number', { length: 100 }),
  registrationDate: date('registration_date'),
  renewalDate: date('renewal_date'),
  logoUrl: text('logo_url'),
  registrationCertificateUrl: text('registration_certificate_url'),
  byeLawsUrl: text('bye_laws_url'),
  bankPassbookUrl: text('bank_passbook_url'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  idxSocietiesSlug: index('idx_societies_slug').on(table.slug),
}));

// Users (Supabase Auth reference profiles)
export const users = pgTable('users', {
  id: uuid('id').primaryKey().notNull(), // Linked to supabase auth.users.id
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password'),
  name: varchar('name', { length: 255 }),
  mobile: varchar('mobile', { length: 15 }),
  avatarUrl: text('avatar_url'),
  defaultSocietyId: uuid('default_society_id'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// System Roles
export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull().unique(), // e.g. 'SUPER_ADMIN', 'SECRETARY', 'OWNER'
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// System Permissions
export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 100 }).notNull().unique(), // e.g. 'billing:create', 'assets:edit'
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Role-Permissions Join Table
export const rolePermissions = pgTable('role_permissions', {
  roleId: uuid('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  permissionId: uuid('permission_id').references(() => permissions.id, { onDelete: 'cascade' }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
}));

// User-Societies Join Table (Resolves user role dynamically per tenant)
export const userSocieties = pgTable('user_societies', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  roleId: uuid('role_id').references(() => roles.id, { onDelete: 'restrict' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxUserSocietiesSearch: index('idx_user_societies_search').on(table.userId, table.societyId),
}));

// ==========================================
// 2. PHYSICAL STRUCTURE (LAYOUT)
// ==========================================

// Buildings (Towers)
export const buildings = pgTable('buildings', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 100 }).notNull(), // e.g. 'Tower A'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxBuildingsSociety: index('idx_buildings_society').on(table.societyId),
}));

// Wings
export const wings = pgTable('wings', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  buildingId: uuid('building_id').references(() => buildings.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 50 }).notNull(), // e.g. 'Wing 1'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxWingsSociety: index('idx_wings_society').on(table.societyId),
}));

// Floors
export const floors = pgTable('floors', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  wingId: uuid('wing_id').references(() => wings.id, { onDelete: 'cascade' }).notNull(),
  number: integer('number').notNull(), // e.g. 5 (5th floor)
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxFloorsSociety: index('idx_floors_society').on(table.societyId),
}));

// Flats (Housing Units)
export const flats = pgTable('flats', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  floorId: uuid('floor_id').references(() => floors.id, { onDelete: 'cascade' }).notNull(),
  number: varchar('number', { length: 50 }).notNull(), // e.g. '502'
  sqftArea: numeric('sqft_area', { precision: 10, scale: 2 }).notNull(),
  carpetArea: numeric('carpet_area', { precision: 10, scale: 2 }),
  terraceArea: numeric('terrace_area', { precision: 10, scale: 2 }),
  flatType: varchar('flat_type', { length: 50 }).notNull(), // e.g. '2BHK', '3BHK', 'Shop'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  idxFlatsSociety: index('idx_flats_society').on(table.societyId),
}));

// ==========================================
// 3. MEMBERS & RESIDENTS
// ==========================================

// Owners (Flat Owners)
export const owners = pgTable('owners', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'restrict' }).notNull(),
  pan: varchar('pan', { length: 10 }),
  aadhaar: varchar('aadhaar', { length: 12 }),
  emergencyContact: varchar('emergency_contact', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxOwnersSociety: index('idx_owners_society').on(table.societyId),
}));

// Join table for Flats to Owners (Co-ownership & Historical Track model)
export const flatOwners = pgTable('flat_owners', {
  id: uuid('id').primaryKey().defaultRandom(),
  flatId: uuid('flat_id').references(() => flats.id, { onDelete: 'cascade' }).notNull(),
  ownerId: uuid('owner_id').references(() => owners.id, { onDelete: 'cascade' }).notNull(),
  isPrimary: boolean('is_primary').default(true).notNull(),
  isCurrent: boolean('is_current').default(true).notNull(),
  startDate: date('start_date').defaultNow().notNull(),
  endDate: date('end_date'),
  ownershipShare: numeric('ownership_share', { precision: 5, scale: 2 }), // e.g. 50.00 %
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxFlatOwnersFlat: index('idx_flat_owners_flat').on(table.flatId),
}));

// Tenants (Flat Renters)
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'restrict' }).notNull(),
  policeVerified: boolean('police_verified').default(false).notNull(),
  policeVerificationDate: date('police_verification_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxTenantsSociety: index('idx_tenants_society').on(table.societyId),
}));

// Join table for Flats to Tenants (Rental track model)
export const flatTenants = pgTable('flat_tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  flatId: uuid('flat_id').references(() => flats.id, { onDelete: 'cascade' }).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  leaseStart: date('lease_start').notNull(),
  leaseEnd: date('lease_end').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  rentalAgreementUrl: text('rental_agreement_url'),
  policeVerificationUrl: text('police_verification_url'),
  tenantNocUrl: text('tenant_noc_url'),
  emergencyContactName: varchar('emergency_contact_name', { length: 150 }),
  emergencyContactPhone: varchar('emergency_contact_phone', { length: 15 }),
  moveInDate: date('move_in_date'),
  moveOutDate: date('move_out_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxFlatTenantsSociety: index('idx_flat_tenants_society').on(table.societyId),
}));

// Members (Active voting & communication list)
export const members = pgTable('members', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'restrict' }).notNull(),
  membershipNumber: varchar('membership_number', { length: 50 }).notNull(),
  memberType: varchar('member_type', { length: 50 }).default('OWNER').notNull(), // Occupancy: OWNER, CO_OWNER, TENANT, FAMILY_MEMBER
  committeeDesignation: varchar('committee_designation', { length: 100 }), // Committee: PRESIDENT, VICE_PRESIDENT, SECRETARY, JOINT_SECRETARY, TREASURER, COMMITTEE_MEMBER, AUDITOR, or null
  photoUrl: text('photo_url'),
  aadhaarUrl: text('aadhaar_url'),
  panUrl: text('pan_url'),
  agreementUrl: text('agreement_url'),
  policeVerificationUrl: text('police_verification_url'),
  emergencyContactName: varchar('emergency_contact_name', { length: 150 }),
  emergencyContactPhone: varchar('emergency_contact_phone', { length: 15 }),
  status: varchar('status', { length: 50 }).default('ACTIVE').notNull(), // ACTIVE, EXPIRED, PENDING, INACTIVE
  canLogin: boolean('can_login').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxMembersSociety: index('idx_members_society').on(table.societyId),
  uqMembershipSociety: index('uq_membership_society').on(table.societyId, table.membershipNumber),
}));

// Family Members Table
export const familyMembers = pgTable('family_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  memberId: uuid('member_id').references(() => members.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 150 }).notNull(),
  relation: varchar('relation', { length: 50 }).notNull(), // Spouse, Son, Daughter, etc.
  mobile: varchar('mobile', { length: 15 }),
  aadhaar: varchar('aadhaar', { length: 12 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxFamilyMembersSociety: index('idx_family_members_society').on(table.societyId),
}));

// Nominees Table
export const nominees = pgTable('nominees', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  memberId: uuid('member_id').references(() => members.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 150 }).notNull(),
  relation: varchar('relation', { length: 50 }).notNull(),
  mobile: varchar('mobile', { length: 15 }),
  sharePercentage: numeric('share_percentage', { precision: 5, scale: 2 }).default('100.00').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxNomineesSociety: index('idx_nominees_society').on(table.societyId),
}));

// ==========================================
// 4. FINANCIAL & BOOKKEEPING (DOUBLE ENTRY)
// ==========================================

// Ledger Accounts (Chart of Accounts)
export const ledgers = pgTable('ledgers', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(), // e.g. 'Bank Account - SBI', 'Maintenance Income'
  group: varchar('group', { length: 100 }).notNull(), // e.g. 'ASSETS', 'LIABILITIES', 'INCOME', 'EXPENSES'
  code: varchar('code', { length: 50 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxLedgersSociety: index('idx_ledgers_society').on(table.societyId),
}));

// Bank Accounts
export const bankAccounts = pgTable('bank_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  ledgerId: uuid('ledger_id').references(() => ledgers.id, { onDelete: 'restrict' }).notNull(), // Direct mapping to ledger
  bankName: varchar('bank_name', { length: 150 }).notNull(), // e.g. 'State Bank of India'
  accountNumber: varchar('account_number', { length: 50 }).notNull(),
  ifsc: varchar('ifsc', { length: 11 }).notNull(),
  branchName: varchar('branch_name', { length: 150 }),
  type: varchar('type', { length: 50 }).default('SAVINGS').notNull(), // SAVINGS, CURRENT
  openingBalance: numeric('opening_balance', { precision: 12, scale: 2 }).default('0.00').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxBankAccountsSociety: index('idx_bank_accounts_society').on(table.societyId),
}));

// Maintenance Billing Heads (Billing Categories)
export const maintenanceHeads = pgTable('maintenance_heads', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  ledgerId: uuid('ledger_id').references(() => ledgers.id, { onDelete: 'restrict' }).notNull(), // Links head to corresponding Income ledger
  name: varchar('name', { length: 150 }).notNull(), // e.g. 'Sinking Fund', 'Lift Charges'
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxMHeadsSociety: index('idx_m_heads_society').on(table.societyId),
}));

// Maintenance Configuration Rates
export const maintenanceRates = pgTable('maintenance_rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  headId: uuid('head_id').references(() => maintenanceHeads.id, { onDelete: 'cascade' }).notNull(),
  flatType: varchar('flat_type', { length: 50 }).notNull(), // Matches flats.flatType or 'ALL'
  calculationType: varchar('calculation_type', { length: 50 }).notNull(), // FIXED, PER_SQFT
  rate: numeric('rate', { precision: 12, scale: 2 }).notNull(), // Amount per billing cycle
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxMRatesSociety: index('idx_m_rates_society').on(table.societyId),
}));

// Maintenance Bills (Invoices)
export const maintenanceBills = pgTable('maintenance_bills', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  flatId: uuid('flat_id').references(() => flats.id, { onDelete: 'restrict' }).notNull(),
  billNumber: varchar('bill_number', { length: 50 }).notNull(),
  billingPeriodStart: date('billing_period_start').notNull(),
  billingPeriodEnd: date('billing_period_end').notNull(),
  dueDate: date('due_date').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status', { length: 50 }).default('UNPAID').notNull(), // UNPAID, PARTIAL, PAID, OVERDUE
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxMBillsSociety: index('idx_m_bills_society').on(table.societyId),
}));

// Bill Items (Detailed itemized breakdown)
export const billItems = pgTable('bill_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  billId: uuid('bill_id').references(() => maintenanceBills.id, { onDelete: 'cascade' }).notNull(),
  headId: uuid('head_id').references(() => maintenanceHeads.id, { onDelete: 'restrict' }).notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
}, (table) => ({
  idxBillItemsSociety: index('idx_bill_items_society').on(table.societyId),
}));

// Receipts (Payments received)
export const receipts = pgTable('receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  billId: uuid('bill_id').references(() => maintenanceBills.id, { onDelete: 'restrict' }).notNull(),
  receiptNumber: varchar('receipt_number', { length: 50 }).notNull(),
  amountPaid: numeric('amount_paid', { precision: 12, scale: 2 }).notNull(),
  paymentMode: varchar('payment_mode', { length: 50 }).notNull(), // CASH, CHEQUE, NEFT, UPI, RTGS, CARD, RAZORPAY
  paymentDate: date('payment_date').notNull(),
  referenceNumber: varchar('reference_number', { length: 100 }), // Transaction ID / Cheque No
  depositAccountId: uuid('deposit_account_id').references(() => bankAccounts.id, { onDelete: 'set null' }), // Bank account where payment is deposited
  chequeStatus: varchar('cheque_status', { length: 50 }), // PENDING, CLEARED, BOUNCED
  status: varchar('status', { length: 50 }).default('CLEARED').notNull(), // CLEARED, BOUNCED, REFUNDED, CANCELLED, REVIEW, REJECTED
  razorpayOrderId: varchar('razorpay_order_id', { length: 100 }),
  razorpayPaymentId: varchar('razorpay_payment_id', { length: 100 }),
  razorpaySignature: varchar('razorpay_signature', { length: 255 }),
  refundedAmount: numeric('refunded_amount', { precision: 12, scale: 2 }),
  lateFeeApplied: numeric('late_fee_applied', { precision: 12, scale: 2 }).default('0.00').notNull(),
  lateFeeWaived: numeric('late_fee_waived', { precision: 12, scale: 2 }).default('0.00').notNull(),
  discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  discountReason: text('discount_reason'),
  cancellationReason: text('cancellation_reason'),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  rejectionReason: text('rejection_reason'),
  userRemark: text('user_remark'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxReceiptsSociety: index('idx_receipts_society').on(table.societyId),
}));

// Vendors
export const vendors = pgTable('vendors', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  contactPerson: varchar('contact_person', { length: 150 }),
  email: varchar('email', { length: 255 }),
  mobile: varchar('mobile', { length: 15 }),
  gstin: varchar('gstin', { length: 15 }),
  pan: varchar('pan', { length: 10 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxVendorsSociety: index('idx_vendors_society').on(table.societyId),
}));

// Vouchers (Accounting Vouchers)
export const vouchers = pgTable('vouchers', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  voucherNumber: varchar('voucher_number', { length: 50 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // RECEIPT, PAYMENT, CONTRA, JOURNAL
  date: date('date').notNull(),
  narration: text('narration'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxVouchersSociety: index('idx_vouchers_society').on(table.societyId),
}));

// Transactions (Double-Entry Debit/Credit Lines)
export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  voucherId: uuid('voucher_id').references(() => vouchers.id, { onDelete: 'cascade' }).notNull(),
  ledgerId: uuid('ledger_id').references(() => ledgers.id, { onDelete: 'restrict' }).notNull(),
  type: varchar('type', { length: 10 }).notNull(), // DEBIT, CREDIT
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
}, (table) => ({
  idxTransactionsSociety: index('idx_transactions_society').on(table.societyId),
}));

// Expenses (Society Expenses mapping to Payment Vouchers)
export const expenses = pgTable('expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  voucherId: uuid('voucher_id').references(() => vouchers.id, { onDelete: 'restrict' }), // Linked Payment/Journal Voucher
  vendorId: uuid('vendor_id').references(() => vendors.id, { onDelete: 'restrict' }),
  billNumber: varchar('bill_number', { length: 100 }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  date: date('date').notNull(),
  status: varchar('status', { length: 50 }).default('UNPAID').notNull(), // PAID, UNPAID, PENDING_APPROVAL
  approvalStatus: varchar('approval_status', { length: 50 }).default('APPROVED').notNull(), // PENDING, APPROVED, REJECTED
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxExpensesSociety: index('idx_expenses_society').on(table.societyId),
}));

// ==========================================
// 5. SECURITY & UTILITY OPERATIONS
// ==========================================

// Parking Slots
export const parkingSlots = pgTable('parking_slots', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  flatId: uuid('flat_id').references(() => flats.id, { onDelete: 'set null' }), // Assigned flat
  slotNumber: varchar('slot_number', { length: 50 }).notNull(),
  type: varchar('type', { length: 50 }).default('OPEN').notNull(), // OPEN, COVERED, RESERVED
  charges: numeric('charges', { precision: 8, scale: 2 }).default('0.00').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxParkingSlotsSociety: index('idx_parking_slots_society').on(table.societyId),
}));

// Vehicles
export const vehicles = pgTable('vehicles', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  flatId: uuid('flat_id').references(() => flats.id, { onDelete: 'cascade' }).notNull(),
  parkingSlotId: uuid('parking_slot_id').references(() => parkingSlots.id, { onDelete: 'set null' }),
  number: varchar('number', { length: 50 }).notNull(), // e.g. MH-12-XX-XXXX
  type: varchar('type', { length: 50 }).default('FOUR_WHEELER').notNull(), // FOUR_WHEELER, TWO_WHEELER, EV_CAR, EV_TWO_WHEELER, COMMERCIAL, BICYCLE
  make: varchar('make', { length: 100 }), // e.g. Honda
  model: varchar('model', { length: 100 }), // e.g. Civic
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxVehiclesSociety: index('idx_vehicles_society').on(table.societyId),
}));

// Visitors (Security Check-in logs)
export const visitors = pgTable('visitors', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  flatId: uuid('flat_id').references(() => flats.id, { onDelete: 'restrict' }).notNull(), // Visiting Flat
  name: varchar('name', { length: 150 }).notNull(),
  mobile: varchar('mobile', { length: 15 }).notNull(),
  vehicleNumber: varchar('vehicle_number', { length: 50 }),
  type: varchar('type', { length: 50 }).default('GUEST').notNull(), // GUEST, DELIVERY, CAB, WORKER
  company: varchar('company', { length: 100 }), // e.g. Zomato, Uber
  purpose: text('purpose'),
  entryTime: timestamp('entry_time', { withTimezone: true }).defaultNow().notNull(),
  exitTime: timestamp('exit_time', { withTimezone: true }),
  gateNo: varchar('gate_no', { length: 50 }),
  status: varchar('status', { length: 50 }).default('PENDING').notNull(), // PENDING, APPROVED, DENIED
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxVisitorsSociety: index('idx_visitors_society').on(table.societyId),
}));

// Staff Members
export const staff = pgTable('staff', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 150 }).notNull(),
  mobile: varchar('mobile', { length: 15 }).notNull(),
  role: varchar('role', { length: 100 }).notNull(), // e.g. SECURITY, CLEANER, ELECTRICIAN, PLUMBER
  salary: numeric('salary', { precision: 10, scale: 2 }).default('0.00'),
  isAvailable: boolean('is_available').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxStaffSociety: index('idx_staff_society').on(table.societyId),
}));

// Staff Attendance Log
export const staffAttendance = pgTable('staff_attendance', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  staffId: uuid('staff_id').references(() => staff.id, { onDelete: 'cascade' }).notNull(),
  date: date('date').notNull(),
  checkIn: timestamp('check_in', { withTimezone: true }),
  checkOut: timestamp('check_out', { withTimezone: true }),
  status: varchar('status', { length: 20 }).default('PRESENT').notNull(), // PRESENT, ABSENT, LEAVE
}, (table) => ({
  idxStaffAttendanceSociety: index('idx_staff_attendance_society').on(table.societyId),
}));

// Staff Payroll Salary records
export const staffSalaries = pgTable('staff_salaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  staffId: uuid('staff_id').references(() => staff.id, { onDelete: 'cascade' }).notNull(),
  month: integer('month').notNull(),
  year: integer('year').notNull(),
  baseAmount: numeric('base_amount', { precision: 10, scale: 2 }).notNull(),
  bonus: numeric('bonus', { precision: 10, scale: 2 }).default('0.00'),
  deductions: numeric('deductions', { precision: 10, scale: 2 }).default('0.00'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  paymentMode: varchar('payment_mode', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxStaffSalariesSociety: index('idx_staff_salaries_society').on(table.societyId),
}));

// Staff Leaves Tracking
export const staffLeaves = pgTable('staff_leaves', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  staffId: uuid('staff_id').references(() => staff.id, { onDelete: 'cascade' }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  reason: text('reason'),
  status: varchar('status', { length: 50 }).default('PENDING').notNull(), // PENDING, APPROVED, REJECTED
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxStaffLeavesSociety: index('idx_staff_leaves_society').on(table.societyId),
}));

// Complaints / Tickets
export const complaints = pgTable('complaints', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  flatId: uuid('flat_id').references(() => flats.id, { onDelete: 'cascade' }).notNull(), // Raised from flat
  raisedByUserId: uuid('raised_by_user_id').references(() => users.id, { onDelete: 'restrict' }).notNull(),
  assignedStaffId: uuid('assigned_staff_id').references(() => staff.id, { onDelete: 'set null' }),
  assignedStaffName: varchar('assigned_staff_name', { length: 150 }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  status: varchar('status', { length: 50 }).default('OPEN').notNull(), // OPEN, ASSIGNED, RESOLVED, CLOSED
  priority: varchar('priority', { length: 20 }).default('MEDIUM').notNull(), // LOW, MEDIUM, HIGH, URGENT
  resolutionComment: text('resolution_comment'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  residentFeedback: text('resident_feedback'),
  rating: integer('rating'),
  escalationLevel: integer('escalation_level').default(0).notNull(),
  escalatedAt: timestamp('escalated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  idxComplaintsSociety: index('idx_complaints_society').on(table.societyId),
}));

// Assets (Capital Equipment)
export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(), // e.g. 'Lift 1 - Tower A', 'Water Pump 3'
  type: varchar('type', { length: 100 }), // e.g. LIFT, PUMP, GENERATOR, FIRE_SYSTEM, CCTV
  purchaseDate: date('purchase_date'),
  cost: numeric('cost', { precision: 12, scale: 2 }),
  warrantyExpiry: date('warranty_expiry'),
  amcProvider: varchar('amc_provider', { length: 255 }), // Annual Maintenance Contract Provider
  amcCost: numeric('amc_cost', { precision: 10, scale: 2 }),
  nextServiceDate: date('next_service_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxAssetsSociety: index('idx_assets_society').on(table.societyId),
}));

// ==========================================
// 6. COMMUNICATION & SETTINGS
// ==========================================

// Notices
export const notices = pgTable('notices', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  type: varchar('type', { length: 50 }).default('GENERAL').notNull(), // GENERAL, EMERGENCY, MEETING, EVENT
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  idxNoticesSociety: index('idx_notices_society').on(table.societyId),
}));

// Meetings
export const meetings = pgTable('meetings', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  location: varchar('location', { length: 255 }).notNull(), // e.g. Clubhouse
  type: varchar('type', { length: 50 }).default('COMMITTEE').notNull(), // AGM, EGM, COMMITTEE, GENERAL
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxMeetingsSociety: index('idx_meetings_society').on(table.societyId),
}));

// Meeting Minutes / Resolutions
export const meetingMinutes = pgTable('meeting_minutes', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  meetingId: uuid('meeting_id').references(() => meetings.id, { onDelete: 'cascade' }).notNull().unique(),
  minutesContent: text('minutes_content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Documents / Contracts (Official files)
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  fileUrl: text('file_url').notNull(),
  fileSize: integer('file_size'),
  category: varchar('category', { length: 100 }).notNull(), // e.g. BYE_LAW, AUDIT_REPORT, CONTRACT, PAN, GST
  isPrivate: boolean('is_private').default(false).notNull(), // If private, download URLs must be pre-signed
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  idxDocumentsSociety: index('idx_documents_society').on(table.societyId),
}));

// Dispatch Notification logs
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  recipientUserId: uuid('recipient_user_id').references(() => users.id, { onDelete: 'set null' }),
  recipientContact: varchar('recipient_contact', { length: 255 }).notNull(), // Email, phone, push token
  channel: varchar('channel', { length: 20 }).notNull(), // EMAIL, SMS, WHATSAPP, PUSH
  title: varchar('title', { length: 255 }),
  body: text('body').notNull(),
  status: varchar('status', { length: 20 }).default('PENDING').notNull(), // PENDING, SENT, FAILED
  errorDetails: text('error_details'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxNotificationsSociety: index('idx_notifications_society').on(table.societyId),
}));

// Audit Logs Table (Mutation tracker)
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'set null' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(), // e.g. 'BILL_CREATE', 'COMPLAINT_RESOLVE'
  entityName: varchar('entity_name', { length: 100 }).notNull(),
  entityId: uuid('entity_id'),
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxAuditLogsSociety: index('idx_audit_logs_society').on(table.societyId),
}));

// Settings
export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull().unique(),
  financialYearStart: date('financial_year_start').default('2026-04-01').notNull(), // Standard Indian FY (April 1st)
  billingFrequency: varchar('billing_frequency', { length: 50 }).default('MONTHLY').notNull(), // MONTHLY, QUARTERLY, YEARLY
  penaltyType: varchar('penalty_type', { length: 50 }).default('PERCENTAGE').notNull(), // PERCENTAGE, FIXED_PER_MONTH, FIXED_ONE_TIME, NONE
  penaltyInterestRate: numeric('penalty_interest_rate', { precision: 5, scale: 2 }).default('12.00').notNull(), // Annual interest e.g. 12%
  penaltyFlatAmount: numeric('penalty_flat_amount', { precision: 10, scale: 2 }).default('200.00').notNull(), // Fixed penalty e.g. ₹200
  penaltyGracePeriodDays: integer('penalty_grace_period_days').default(0).notNull(), // Days after due date before penalty applies
  invoiceDueDays: integer('invoice_due_days').default(15).notNull(),
  maintenanceFormula: text('maintenance_formula').default('(area * rate) + parking + water').notNull(),
  calculationType: varchar('calculation_type', { length: 50 }).default('PER_SQ_FT').notNull(), // PER_SQ_FT, PER_FLAT_TYPE, FLAT_RATE_SAME_FOR_ALL
  perSqFtRate: numeric('per_sqft_rate', { precision: 10, scale: 2 }).default('3.50').notNull(),
  sqftAreaType: varchar('sqft_area_type', { length: 50 }).default('SUPER_BUILTUP').notNull(), // SUPER_BUILTUP, CARPET_AREA
  flatRateSameForAll: numeric('flat_rate_same_for_all', { precision: 10, scale: 2 }).default('2500.00').notNull(),
  perFlatTypeRates: text('per_flat_type_rates').default('{"1BHK":1500,"2BHK":2500,"3BHK":3500,"Shop":4000}').notNull(),
  flatTypes: text('flat_types').default('["1BHK","2BHK","3BHK","4BHK","Penthouse","Shop"]').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// Drizzle Relations Map Definitions
// ==========================================

export const societiesRelations = relations(societies, ({ many, one }) => ({
  buildings: many(buildings),
  wings: many(wings),
  floors: many(floors),
  flats: many(flats),
  owners: many(owners),
  tenants: many(tenants),
  members: many(members),
  ledgers: many(ledgers),
  bankAccounts: many(bankAccounts),
  maintenanceHeads: many(maintenanceHeads),
  maintenanceRates: many(maintenanceRates),
  maintenanceBills: many(maintenanceBills),
  receipts: many(receipts),
  vouchers: many(vouchers),
  expenses: many(expenses),
  parkingSlots: many(parkingSlots),
  vehicles: many(vehicles),
  visitors: many(visitors),
  staff: many(staff),
  complaints: many(complaints),
  assets: many(assets),
  notices: many(notices),
  meetings: many(meetings),
  documents: many(documents),
  notifications: many(notifications),
  auditLogs: many(auditLogs),
  settings: one(settings, {
    fields: [societies.id],
    references: [settings.societyId],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(userSocieties),
  owners: many(owners),
  tenants: many(tenants),
  members: many(members),
  complaints: many(complaints),
  notifications: many(notifications),
  auditLogs: many(auditLogs),
}));

export const userSocietiesRelations = relations(userSocieties, ({ one }) => ({
  user: one(users, { fields: [userSocieties.userId], references: [users.id] }),
  society: one(societies, { fields: [userSocieties.societyId], references: [societies.id] }),
  role: one(roles, { fields: [userSocieties.roleId], references: [roles.id] }),
}));

export const buildingsRelations = relations(buildings, ({ one, many }) => ({
  society: one(societies, { fields: [buildings.societyId], references: [societies.id] }),
  wings: many(wings),
}));

export const wingsRelations = relations(wings, ({ one, many }) => ({
  society: one(societies, { fields: [wings.societyId], references: [societies.id] }),
  building: one(buildings, { fields: [wings.buildingId], references: [buildings.id] }),
  floors: many(floors),
}));

export const floorsRelations = relations(floors, ({ one, many }) => ({
  society: one(societies, { fields: [floors.societyId], references: [societies.id] }),
  wing: one(wings, { fields: [floors.wingId], references: [wings.id] }),
  flats: many(flats),
}));

export const flatsRelations = relations(flats, ({ one, many }) => ({
  society: one(societies, { fields: [flats.societyId], references: [societies.id] }),
  floor: one(floors, { fields: [flats.floorId], references: [floors.id] }),
  owners: many(flatOwners),
  tenants: many(flatTenants),
  parkingSlots: many(parkingSlots),
  vehicles: many(vehicles),
  visitors: many(visitors),
  complaints: many(complaints),
  maintenanceBills: many(maintenanceBills),
}));

export const ownersRelations = relations(owners, ({ one, many }) => ({
  society: one(societies, { fields: [owners.societyId], references: [societies.id] }),
  user: one(users, { fields: [owners.userId], references: [users.id] }),
  flats: many(flatOwners),
}));

export const flatOwnersRelations = relations(flatOwners, ({ one }) => ({
  flat: one(flats, { fields: [flatOwners.flatId], references: [flats.id] }),
  owner: one(owners, { fields: [flatOwners.ownerId], references: [owners.id] }),
}));

export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  society: one(societies, { fields: [tenants.societyId], references: [societies.id] }),
  user: one(users, { fields: [tenants.userId], references: [users.id] }),
  flats: many(flatTenants),
}));

export const flatTenantsRelations = relations(flatTenants, ({ one }) => ({
  flat: one(flats, { fields: [flatTenants.flatId], references: [flats.id] }),
  tenant: one(tenants, { fields: [flatTenants.tenantId], references: [tenants.id] }),
}));

export const ledgersRelations = relations(ledgers, ({ one, many }) => ({
  society: one(societies, { fields: [ledgers.societyId], references: [societies.id] }),
  bankAccounts: many(bankAccounts),
  maintenanceHeads: many(maintenanceHeads),
  transactions: many(transactions),
}));

export const bankAccountsRelations = relations(bankAccounts, ({ one }) => ({
  society: one(societies, { fields: [bankAccounts.societyId], references: [societies.id] }),
  ledger: one(ledgers, { fields: [bankAccounts.ledgerId], references: [ledgers.id] }),
}));

export const maintenanceHeadsRelations = relations(maintenanceHeads, ({ one, many }) => ({
  society: one(societies, { fields: [maintenanceHeads.societyId], references: [societies.id] }),
  ledger: one(ledgers, { fields: [maintenanceHeads.ledgerId], references: [ledgers.id] }),
  rates: many(maintenanceRates),
  billItems: many(billItems),
}));

export const maintenanceBillsRelations = relations(maintenanceBills, ({ one, many }) => ({
  society: one(societies, { fields: [maintenanceBills.societyId], references: [societies.id] }),
  flat: one(flats, { fields: [maintenanceBills.flatId], references: [flats.id] }),
  items: many(billItems),
  receipts: many(receipts),
}));

export const billItemsRelations = relations(billItems, ({ one }) => ({
  bill: one(maintenanceBills, { fields: [billItems.billId], references: [maintenanceBills.id] }),
  head: one(maintenanceHeads, { fields: [billItems.headId], references: [maintenanceHeads.id] }),
}));

export const receiptsRelations = relations(receipts, ({ one }) => ({
  society: one(societies, { fields: [receipts.societyId], references: [societies.id] }),
  bill: one(maintenanceBills, { fields: [receipts.billId], references: [maintenanceBills.id] }),
}));

export const vouchersRelations = relations(vouchers, ({ one, many }) => ({
  society: one(societies, { fields: [vouchers.societyId], references: [societies.id] }),
  transactions: many(transactions),
  expenses: many(expenses),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  society: one(societies, { fields: [transactions.societyId], references: [societies.id] }),
  voucher: one(vouchers, { fields: [transactions.voucherId], references: [vouchers.id] }),
  ledger: one(ledgers, { fields: [transactions.ledgerId], references: [ledgers.id] }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  society: one(societies, { fields: [expenses.societyId], references: [societies.id] }),
  voucher: one(vouchers, { fields: [expenses.voucherId], references: [vouchers.id] }),
  vendor: one(vendors, { fields: [expenses.vendorId], references: [vendors.id] }),
}));

export const parkingSlotsRelations = relations(parkingSlots, ({ one, many }) => ({
  society: one(societies, { fields: [parkingSlots.societyId], references: [societies.id] }),
  flat: one(flats, { fields: [parkingSlots.flatId], references: [flats.id] }),
  vehicles: many(vehicles),
}));

export const vehiclesRelations = relations(vehicles, ({ one }) => ({
  society: one(societies, { fields: [vehicles.societyId], references: [societies.id] }),
  flat: one(flats, { fields: [vehicles.flatId], references: [flats.id] }),
  parkingSlot: one(parkingSlots, { fields: [vehicles.parkingSlotId], references: [parkingSlots.id] }),
}));

export const staffRelations = relations(staff, ({ one, many }) => ({
  society: one(societies, { fields: [staff.societyId], references: [societies.id] }),
  attendance: many(staffAttendance),
  salaries: many(staffSalaries),
  leaves: many(staffLeaves),
  assignedComplaints: many(complaints),
}));

export const staffAttendanceRelations = relations(staffAttendance, ({ one }) => ({
  staff: one(staff, { fields: [staffAttendance.staffId], references: [staff.id] }),
}));

export const staffSalariesRelations = relations(staffSalaries, ({ one }) => ({
  staff: one(staff, { fields: [staffSalaries.staffId], references: [staff.id] }),
}));

export const staffLeavesRelations = relations(staffLeaves, ({ one }) => ({
  staff: one(staff, { fields: [staffLeaves.staffId], references: [staff.id] }),
}));

export const complaintsRelations = relations(complaints, ({ one }) => ({
  society: one(societies, { fields: [complaints.societyId], references: [societies.id] }),
  flat: one(flats, { fields: [complaints.flatId], references: [flats.id] }),
  raisedBy: one(users, { fields: [complaints.raisedByUserId], references: [users.id] }),
  assignedStaff: one(staff, { fields: [complaints.assignedStaffId], references: [staff.id] }),
}));

export const meetingsRelations = relations(meetings, ({ one }) => ({
  society: one(societies, { fields: [meetings.societyId], references: [societies.id] }),
  minutes: one(meetingMinutes, { fields: [meetings.id], references: [meetingMinutes.meetingId] }),
}));

// Voting Polls
export const polls = pgTable('polls', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  question: varchar('question', { length: 255 }).notNull(),
  description: text('description'),
  endDate: date('end_date').notNull(),
  status: varchar('status', { length: 50 }).default('ACTIVE').notNull(), // ACTIVE, CLOSED
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxPollsSociety: index('idx_polls_society').on(table.societyId),
}));

// Poll Votes
export const pollVotes = pgTable('poll_votes', {
  id: uuid('id').primaryKey().defaultRandom(),
  pollId: uuid('poll_id').references(() => polls.id, { onDelete: 'cascade' }).notNull(),
  memberId: uuid('member_id').references(() => members.id, { onDelete: 'cascade' }).notNull(),
  choice: varchar('choice', { length: 50 }).notNull(), // YES, NO, ABSTAIN
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Asset Maintenance & Repairs Logs
export const assetLogs = pgTable('asset_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'cascade' }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // MAINTENANCE, REPAIR
  description: text('description').notNull(),
  cost: numeric('cost', { precision: 12, scale: 2 }).default('0.00').notNull(),
  date: date('date').notNull(),
  status: varchar('status', { length: 50 }).default('SCHEDULED').notNull(), // SCHEDULED, COMPLETED
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Notification Templates
export const notificationTemplates = pgTable('notification_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 100 }).notNull(), // e.g. 'DUES_REMINDER', 'VISITOR_CHECKIN'
  subject: varchar('subject', { length: 255 }),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Notification Dispatch Logs
export const notificationLogs = pgTable('notification_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'restrict' }).notNull(),
  channel: varchar('channel', { length: 50 }).notNull(), // EMAIL, SMS, WHATSAPP, PUSH
  status: varchar('status', { length: 50 }).default('SENT').notNull(), // SENT, FAILED, RETRYING
  attempts: integer('attempts').default(1).notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Global Billing Plans
export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(), // Basic, Premium, Enterprise
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  maxFlats: integer('max_flats').default(100).notNull(),
  maxStorageGb: integer('max_storage_gb').default(10).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Tenant Subscriptions
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  planId: uuid('plan_id').references(() => plans.id, { onDelete: 'restrict' }).notNull(),
  status: varchar('status', { length: 50 }).default('ACTIVE').notNull(), // ACTIVE, EXPIRED
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Global Feature Flags Toggles
export const featureFlags = pgTable('feature_flags', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(), // e.g. 'ONLINE_PAYMENTS', 'CHAT_FORUM'
  isEnabled: boolean('is_enabled').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Global System Log files
export const systemLogs = pgTable('system_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  level: varchar('level', { length: 50 }).notNull(), // INFO, WARN, ERROR
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// CUSTOM SQL REPORT BUILDER
// ==========================================

// Custom Report Definitions (created by SUPER_ADMIN / SOCIETY_ADMIN)
export const customReports = pgTable('custom_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  sqlQuery: text('sql_query').notNull(),
  // JSONB array: [{key, label, type: 'text'|'date'|'date_range'|'in_list'}]
  parameters: jsonb('parameters').default([]).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  idxCustomReportsSociety: index('idx_custom_reports_society').on(table.societyId),
}));

// Per-User Favorites for Custom Reports
export const customReportFavorites = pgTable('custom_report_favorites', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportId: uuid('report_id').references(() => customReports.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  societyId: uuid('society_id').references(() => societies.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxCustomReportFavoritesUser: index('idx_custom_report_fav_user').on(table.userId, table.societyId),
}));

// Monthly Storage Operation Usage (Free Tier Safety Guardrail)
export const storageUsage = pgTable('storage_usage', {
  monthKey: varchar('month_key', { length: 7 }).primaryKey().notNull(), // 'YYYY-MM' e.g. '2026-08'
  uploadCount: integer('upload_count').default(0).notNull(),
  totalBytes: numeric('total_bytes', { precision: 20, scale: 0 }).default('0').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
