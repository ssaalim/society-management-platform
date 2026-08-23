import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgresModule from 'postgres';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';

// Support multiple environments
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
} else if (fs.existsSync('.env')) {
  dotenv.config({ path: '.env' });
}

// Handle ESM/CJS interop
const postgres = (postgresModule as any).default || postgresModule;

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5432/society_db';

// ==========================================
// DETERMINISTIC UUID CONSTANTS FOR DEMO DATA
// ==========================================

// Roles
const ROLE_SUPER_ADMIN_ID = '10000000-0000-0000-0000-000000000001';
const ROLE_SECRETARY_ID   = '10000000-0000-0000-0000-000000000002';
const ROLE_TREASURER_ID   = '10000000-0000-0000-0000-000000000003';
const ROLE_COMMITTEE_ID   = '10000000-0000-0000-0000-000000000004';
const ROLE_OWNER_ID       = '10000000-0000-0000-0000-000000000005';
const ROLE_TENANT_ID      = '10000000-0000-0000-0000-000000000006';
const ROLE_PRESIDENT_ID   = '10000000-0000-0000-0000-000000000007';
const ROLE_ACCOUNTANT_ID  = '10000000-0000-0000-0000-000000000008';

// Users
const USER_SUPER_ADMIN_ID = '20000000-0000-0000-0000-000000000001';
const USER_SECRETARY_ID   = '20000000-0000-0000-0000-000000000002';
const USER_TREASURER_ID   = '20000000-0000-0000-0000-000000000003';
const USER_COMMITTEE_ID   = '20000000-0000-0000-0000-000000000004';
const USER_RESIDENT_ID    = '20000000-0000-0000-0000-000000000005';
const USER_TENANT_1_ID    = '20000000-0000-0000-0000-000000000006';
const USER_PRESIDENT_ID   = '20000000-0000-0000-0000-000000000007';
const USER_ACCOUNTANT_ID  = '20000000-0000-0000-0000-000000000008';

// Societies
const SOCIETY_SUNVIEW_ID   = '30000000-0000-0000-0000-000000000001';
const SOCIETY_GREENPARK_ID = '30000000-0000-0000-0000-000000000002';

// Buildings & Wings & Floors & Flats (Sunview)
const B_TOWER_A_ID = '50000000-0000-0000-0000-000000000001';
const B_TOWER_B_ID = '50000000-0000-0000-0000-000000000002';

const WING_A1_ID   = '51000000-0000-0000-0000-000000000001';
const WING_B1_ID   = '51000000-0000-0000-0000-000000000002';

const FLOOR_1_ID   = '52000000-0000-0000-0000-000000000001';
const FLOOR_2_ID   = '52000000-0000-0000-0000-000000000002';
const FLOOR_3_ID   = '52000000-0000-0000-0000-000000000003';

const FLAT_101_ID  = '53000000-0000-0000-0000-000000000001';
const FLAT_102_ID  = '53000000-0000-0000-0000-000000000002';
const FLAT_201_ID  = '53000000-0000-0000-0000-000000000003';
const FLAT_301_ID  = '53000000-0000-0000-0000-000000000004';
const FLAT_302_ID  = '53000000-0000-0000-0000-000000000005';

// Permissions
const PERM_IDS = {
  'flat:read':         '40000000-0000-0000-0000-000000000001',
  'flat:write':        '40000000-0000-0000-0000-000000000002',
  'member:read':       '40000000-0000-0000-0000-000000000003',
  'member:write':      '40000000-0000-0000-0000-000000000004',
  'billing:read':      '40000000-0000-0000-0000-000000000005',
  'billing:write':     '40000000-0000-0000-0000-000000000006',
  'accounting:read':   '40000000-0000-0000-0000-000000000007',
  'accounting:write':  '40000000-0000-0000-0000-000000000008',
  'society:read':      '40000000-0000-0000-0000-000000000009',
  'society:write':     '40000000-0000-0000-0000-000000000010',
  'resident:read':     '40000000-0000-0000-0000-000000000011',
  'resident:write':    '40000000-0000-0000-0000-000000000012',
};

// Role -> Permission mappings
const ROLE_PERMISSIONS: Record<string, string[]> = {
  [ROLE_SUPER_ADMIN_ID]: Object.keys(PERM_IDS),
  [ROLE_PRESIDENT_ID]: Object.keys(PERM_IDS),
  [ROLE_SECRETARY_ID]: Object.keys(PERM_IDS),
  [ROLE_TREASURER_ID]: [
    'flat:read', 'member:read', 'billing:read', 'billing:write',
    'accounting:read', 'accounting:write', 'society:read', 'resident:read',
  ],
  [ROLE_ACCOUNTANT_ID]: [
    'flat:read', 'member:read', 'billing:read', 'billing:write',
    'accounting:read', 'accounting:write', 'society:read',
  ],
  [ROLE_COMMITTEE_ID]: [
    'flat:read', 'member:read', 'member:write', 'billing:read',
    'accounting:read', 'society:read', 'resident:read',
  ],
  [ROLE_OWNER_ID]: [
    'flat:read', 'member:read', 'billing:read', 'society:read',
    'resident:read', 'resident:write',
  ],
  [ROLE_TENANT_ID]: [
    'flat:read', 'member:read', 'billing:read', 'society:read',
    'resident:read', 'resident:write',
  ],
};

async function seed() {
  console.log('🌱 Seeding database with rich demo data across all tables...\n');

  const client = postgres(dbUrl, { max: 1 });

  try {
    // ----------------------------------------------------
    // CLEANUP STALE DEMO DATA BEFORE RE-INSERTING
    // ----------------------------------------------------
    await client`ALTER TABLE flat_owners DROP CONSTRAINT IF EXISTS flat_owners_pkey;`;
    await client`ALTER TABLE flat_owners ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();`;
    await client`ALTER TABLE flat_owners ADD COLUMN IF NOT EXISTS is_current boolean DEFAULT true NOT NULL;`;
    await client`ALTER TABLE flat_owners ADD COLUMN IF NOT EXISTS start_date date DEFAULT CURRENT_DATE NOT NULL;`;
    await client`ALTER TABLE flat_owners ADD COLUMN IF NOT EXISTS end_date date;`;
    await client`ALTER TABLE flat_owners ADD COLUMN IF NOT EXISTS notes text;`;

    await client`ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS opening_balance numeric(12, 2) DEFAULT '0.00' NOT NULL;`;
    await client`ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false NOT NULL;`;

    await client`ALTER TABLE settings ADD COLUMN IF NOT EXISTS calculation_type varchar(50) DEFAULT 'PER_SQ_FT' NOT NULL;`;
    await client`ALTER TABLE settings ADD COLUMN IF NOT EXISTS per_sqft_rate numeric(10, 2) DEFAULT '3.50' NOT NULL;`;
    await client`ALTER TABLE settings ADD COLUMN IF NOT EXISTS flat_rate_same_for_all numeric(10, 2) DEFAULT '2500.00' NOT NULL;`;
    await client`ALTER TABLE settings ADD COLUMN IF NOT EXISTS per_flat_type_rates text DEFAULT '{"1BHK":1500,"2BHK":2500,"3BHK":3500,"Shop":4000}' NOT NULL;`;

    await client`
      TRUNCATE 
        audit_logs, notifications, documents, meeting_minutes, meetings, notices,
        assets, complaints, staff_leaves, staff_salaries, staff_attendance, staff,
        visitors, vehicles, parking_slots, expenses, transactions, vouchers,
        vendors, receipts, bill_items, maintenance_bills, maintenance_rates,
        maintenance_heads, bank_accounts, ledgers, nominees, family_members,
        members, flat_tenants, tenants, flat_owners, owners, flats, floors,
        wings, buildings, user_societies, role_permissions, permissions, roles,
        users, societies, settings
      CASCADE;
    `;

    // ==========================================
    // 1. ROLES & PERMISSIONS
    // ==========================================
    console.log('  → Creating Roles & Permissions...');
    const rolesData = [
      { id: ROLE_SUPER_ADMIN_ID, name: 'SUPER_ADMIN', description: 'Platform-level super administrator with full access.' },
      { id: ROLE_PRESIDENT_ID, name: 'PRESIDENT', description: 'Society president with executive oversight and approval authority.' },
      { id: ROLE_SECRETARY_ID, name: 'SECRETARY', description: 'Society secretary with full management capabilities.' },
      { id: ROLE_TREASURER_ID, name: 'TREASURER', description: 'Manages billing, accounting, and financial reports.' },
      { id: ROLE_ACCOUNTANT_ID, name: 'ACCOUNTANT', description: 'Handles bookkeeping, ledger entries, and financial reporting.' },
      { id: ROLE_COMMITTEE_ID, name: 'COMMITTEE_MEMBER', description: 'Committee member with read access and complaint management.' },
      { id: ROLE_OWNER_ID, name: 'OWNER', description: 'Flat owner with viewing permissions.' },
      { id: ROLE_TENANT_ID, name: 'TENANT', description: 'Renting tenant resident with unit and gate pre-approval access.' },
    ];
    for (const role of rolesData) {
      await client`INSERT INTO roles (id, name, description) VALUES (${role.id}, ${role.name}, ${role.description});`;
    }

    for (const [key, id] of Object.entries(PERM_IDS)) {
      await client`INSERT INTO permissions (id, key, description) VALUES (${id}, ${key}, ${'Permission: ' + key});`;
    }

    for (const [roleId, permKeys] of Object.entries(ROLE_PERMISSIONS)) {
      for (const permKey of permKeys) {
        const permId = PERM_IDS[permKey as keyof typeof PERM_IDS];
        await client`INSERT INTO role_permissions (role_id, permission_id) VALUES (${roleId}, ${permId});`;
      }
    }
    console.log('    ✓ Roles and Permissions created');

    // ==========================================
    // 2. USERS & SOCIETIES
    // ==========================================
    console.log('  → Creating Users & Societies...');
    const usersData = [
      { id: USER_SUPER_ADMIN_ID, email: 'superadmin@society.dev', name: 'Rajesh Kumar (Super Admin)', mobile: '+919000000001' },
      { id: USER_PRESIDENT_ID, email: 'president@society.dev', name: 'Suresh Desai (President)', mobile: '+919000000007' },
      { id: USER_SECRETARY_ID, email: 'secretary@society.dev', name: 'Priya Sharma (Secretary)', mobile: '+919000000002' },
      { id: USER_TREASURER_ID, email: 'treasurer@society.dev', name: 'Amit Patel (Treasurer)', mobile: '+919000000003' },
      { id: USER_ACCOUNTANT_ID, email: 'accountant@society.dev', name: 'Meera Joshi (Accountant)', mobile: '+919000000008' },
      { id: USER_COMMITTEE_ID, email: 'committee@society.dev', name: 'Sneha Gupta (Committee)', mobile: '+919000000004' },
      { id: USER_RESIDENT_ID, email: 'resident@society.dev', name: 'Vikram Singh (Owner)', mobile: '+919000000005' },
      { id: USER_TENANT_1_ID, email: 'tenant1@society.dev', name: 'Rahul Mehta (Tenant)', mobile: '+919000000006' },
    ];
    const defaultHashedPassword = bcrypt.hashSync('password123', 10);
    for (const u of usersData) {
      await client`INSERT INTO users (id, email, password, name, mobile) VALUES (${u.id}, ${u.email}, ${defaultHashedPassword}, ${u.name}, ${u.mobile});`;
    }

    const societiesData = [
      {
        id: SOCIETY_SUNVIEW_ID,
        name: 'Sunview Heights CHS Ltd.',
        slug: 'sunview-heights',
        address: 'Plot No. 42, Sector 21, Kharghar, Navi Mumbai - 410210',
        registrationNumber: 'MH/HSG/2018/00042',
        gstin: '27AABCS1234H1Z5',
        pan: 'AABCS1234H',
      },
      {
        id: SOCIETY_GREENPARK_ID,
        name: 'Green Park Residency CHS Ltd.',
        slug: 'green-park',
        address: '15/A, Baner Road, Baner, Pune - 411045',
        registrationNumber: 'MH/HSG/2020/00108',
        gstin: '27AABCG5678K1Z9',
        pan: 'AABCG5678K',
      },
    ];
    for (const s of societiesData) {
      await client`
        INSERT INTO societies (id, name, slug, address, registration_number, gstin, pan)
        VALUES (${s.id}, ${s.name}, ${s.slug}, ${s.address}, ${s.registrationNumber}, ${s.gstin}, ${s.pan});
      `;
    }

    // User Memberships
    const memberships = [
      { userId: USER_SUPER_ADMIN_ID, societyId: SOCIETY_SUNVIEW_ID, roleId: ROLE_SUPER_ADMIN_ID },
      { userId: USER_SUPER_ADMIN_ID, societyId: SOCIETY_GREENPARK_ID, roleId: ROLE_SUPER_ADMIN_ID },
      { userId: USER_PRESIDENT_ID, societyId: SOCIETY_SUNVIEW_ID, roleId: ROLE_PRESIDENT_ID },
      { userId: USER_SECRETARY_ID, societyId: SOCIETY_SUNVIEW_ID, roleId: ROLE_SECRETARY_ID },
      { userId: USER_TREASURER_ID, societyId: SOCIETY_SUNVIEW_ID, roleId: ROLE_TREASURER_ID },
      { userId: USER_ACCOUNTANT_ID, societyId: SOCIETY_SUNVIEW_ID, roleId: ROLE_ACCOUNTANT_ID },
      { userId: USER_COMMITTEE_ID, societyId: SOCIETY_SUNVIEW_ID, roleId: ROLE_COMMITTEE_ID },
      { userId: USER_COMMITTEE_ID, societyId: SOCIETY_GREENPARK_ID, roleId: ROLE_SECRETARY_ID },
      { userId: USER_RESIDENT_ID, societyId: SOCIETY_SUNVIEW_ID, roleId: ROLE_OWNER_ID },
      { userId: USER_TENANT_1_ID, societyId: SOCIETY_SUNVIEW_ID, roleId: ROLE_TENANT_ID },
    ];
    for (const m of memberships) {
      await client`INSERT INTO user_societies (id, user_id, society_id, role_id) VALUES (${uuidv4()}, ${m.userId}, ${m.societyId}, ${m.roleId});`;
    }
    console.log('    ✓ Users & Societies seeded');

    // ==========================================
    // 3. PHYSICAL STRUCTURE (Towers, Wings, Floors, Flats)
    // ==========================================
    console.log('  → Creating Layout Structure (Buildings, Wings, Floors, Flats)...');
    await client`INSERT INTO buildings (id, society_id, name) VALUES (${B_TOWER_A_ID}, ${SOCIETY_SUNVIEW_ID}, 'Tower A - Emerald');`;
    await client`INSERT INTO buildings (id, society_id, name) VALUES (${B_TOWER_B_ID}, ${SOCIETY_SUNVIEW_ID}, 'Tower B - Ruby');`;

    await client`INSERT INTO wings (id, society_id, building_id, name) VALUES (${WING_A1_ID}, ${SOCIETY_SUNVIEW_ID}, ${B_TOWER_A_ID}, 'Wing A1');`;
    await client`INSERT INTO wings (id, society_id, building_id, name) VALUES (${WING_B1_ID}, ${SOCIETY_SUNVIEW_ID}, ${B_TOWER_B_ID}, 'Wing B1');`;

    await client`INSERT INTO floors (id, society_id, wing_id, number) VALUES (${FLOOR_1_ID}, ${SOCIETY_SUNVIEW_ID}, ${WING_A1_ID}, 1);`;
    await client`INSERT INTO floors (id, society_id, wing_id, number) VALUES (${FLOOR_2_ID}, ${SOCIETY_SUNVIEW_ID}, ${WING_A1_ID}, 2);`;
    await client`INSERT INTO floors (id, society_id, wing_id, number) VALUES (${FLOOR_3_ID}, ${SOCIETY_SUNVIEW_ID}, ${WING_A1_ID}, 3);`;

    const FLAT_103_ID = uuidv4();
    const FLAT_202_ID = uuidv4();
    const FLAT_B101_ID = uuidv4();
    const FLAT_B102_ID = uuidv4();

    const flatsData = [
      { id: FLAT_101_ID, floorId: FLOOR_1_ID, number: '101', sqft: '1150.00', carpet: '850.00', type: '2BHK' },
      { id: FLAT_102_ID, floorId: FLOOR_1_ID, number: '102', sqft: '1450.00', carpet: '1100.00', type: '3BHK' },
      { id: FLAT_103_ID, floorId: FLOOR_1_ID, number: '103', sqft: '950.00', carpet: '700.00', type: '1BHK' },
      { id: FLAT_201_ID, floorId: FLOOR_2_ID, number: '201', sqft: '1150.00', carpet: '850.00', type: '2BHK' },
      { id: FLAT_202_ID, floorId: FLOOR_2_ID, number: '202', sqft: '1450.00', carpet: '1100.00', type: '3BHK' },
      { id: FLAT_301_ID, floorId: FLOOR_3_ID, number: '301', sqft: '1450.00', carpet: '1100.00', type: '3BHK' },
      { id: FLAT_302_ID, floorId: FLOOR_3_ID, number: '302', sqft: '1850.00', carpet: '1450.00', type: '4BHK Penthouse' },
      { id: FLAT_B101_ID, floorId: FLOOR_1_ID, number: 'B-101', sqft: '650.00', carpet: '500.00', type: 'Shop / Retail' },
      { id: FLAT_B102_ID, floorId: FLOOR_1_ID, number: 'B-102', sqft: '1200.00', carpet: '900.00', type: 'Commercial Office' },
    ];
    for (const f of flatsData) {
      await client`
        INSERT INTO flats (id, society_id, floor_id, number, sqft_area, carpet_area, flat_type)
        VALUES (${f.id}, ${SOCIETY_SUNVIEW_ID}, ${f.floorId}, ${f.number}, ${f.sqft}, ${f.carpet}, ${f.type});
      `;
    }
    console.log('    ✓ Physical layout seeded (9 Flats across 3 Floors & 2 Towers)');

    // ==========================================
    // 4. MEMBERS, OWNERS & TENANTS
    // ==========================================
    console.log('  → Creating Owners, Tenants, Members, Family & Nominees...');
    const ownerSecretaryId  = uuidv4();
    const ownerResidentId   = uuidv4();
    const ownerPresidentId  = uuidv4();
    const ownerTreasurerId  = uuidv4();
    const ownerAccountantId = uuidv4();
    const ownerCommitteeId  = uuidv4();
    const tenantRahulId     = uuidv4();

    await client`
      INSERT INTO owners (id, society_id, user_id, pan, aadhaar, emergency_contact)
      VALUES 
        (${ownerSecretaryId}, ${SOCIETY_SUNVIEW_ID}, ${USER_SECRETARY_ID}, 'ABCPS1234F', '987654321012', '+919000000002'),
        (${ownerPresidentId}, ${SOCIETY_SUNVIEW_ID}, ${USER_PRESIDENT_ID}, 'PQRSD9876L', '567890123456', '+919000000007'),
        (${ownerTreasurerId}, ${SOCIETY_SUNVIEW_ID}, ${USER_TREASURER_ID}, 'AMTPT8829K', '345678901234', '+919000000003'),
        (${ownerAccountantId}, ${SOCIETY_SUNVIEW_ID}, ${USER_ACCOUNTANT_ID}, 'MRJSH7721N', '456789012345', '+919000000008'),
        (${ownerCommitteeId}, ${SOCIETY_SUNVIEW_ID}, ${USER_COMMITTEE_ID}, 'SNHGP6632M', '678901234567', '+919000000004'),
        (${ownerResidentId}, ${SOCIETY_SUNVIEW_ID}, ${USER_RESIDENT_ID}, 'XYZPS5678K', '123456789012', '+919000000005');
    `;

    await client`
      INSERT INTO flat_owners (flat_id, owner_id, is_primary, is_current, start_date, notes, ownership_share)
      VALUES 
        (${FLAT_101_ID}, ${ownerSecretaryId}, true, true, '2024-01-01', 'Original Initial Allotment', '100.00'),
        (${FLAT_201_ID}, ${ownerPresidentId}, true, true, '2023-05-15', 'Original Purchase', '100.00'),
        (${FLAT_202_ID}, ${ownerTreasurerId}, true, true, '2022-11-10', 'Primary Owner', '100.00'),
        (${FLAT_301_ID}, ${ownerResidentId}, true, true, '2025-02-01', 'Resale Agreement Transfer', '100.00'),
        (${FLAT_302_ID}, ${ownerCommitteeId}, true, true, '2021-08-20', 'Original Owner', '100.00'),
        (${FLAT_B101_ID}, ${ownerAccountantId}, true, true, '2023-09-12', 'Registered Allottee', '100.00');
    `;

    await client`
      INSERT INTO tenants (id, society_id, user_id, police_verified, police_verification_date)
      VALUES (${tenantRahulId}, ${SOCIETY_SUNVIEW_ID}, ${USER_TENANT_1_ID}, true, '2026-01-15');
    `;

    await client`
      INSERT INTO flat_tenants (id, society_id, flat_id, tenant_id, lease_start, lease_end, is_active)
      VALUES (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${FLAT_102_ID}, ${tenantRahulId}, '2026-01-01', '2026-12-31', true);
    `;

    // Members roster covering all member types & statuses (ACTIVE, EXPIRED, PENDING)
    const mem1Id = uuidv4();
    const mem2Id = uuidv4();
    const mem3Id = uuidv4();
    const mem4Id = uuidv4();
    const mem5Id = uuidv4();
    const mem6Id = uuidv4();
    const memTenantId = uuidv4();

    await client`
      INSERT INTO members (id, society_id, user_id, membership_number, member_type, status)
      VALUES 
        (${mem1Id}, ${SOCIETY_SUNVIEW_ID}, ${USER_SECRETARY_ID}, 'MEM-2026-001', 'OWNER', 'ACTIVE'),
        (${mem3Id}, ${SOCIETY_SUNVIEW_ID}, ${USER_PRESIDENT_ID}, 'MEM-2026-003', 'OWNER', 'ACTIVE'),
        (${mem4Id}, ${SOCIETY_SUNVIEW_ID}, ${USER_TREASURER_ID}, 'MEM-2026-004', 'OWNER', 'ACTIVE'),
        (${mem5Id}, ${SOCIETY_SUNVIEW_ID}, ${USER_ACCOUNTANT_ID}, 'MEM-2026-005', 'OWNER', 'ACTIVE'),
        (${mem6Id}, ${SOCIETY_SUNVIEW_ID}, ${USER_COMMITTEE_ID}, 'MEM-2026-006', 'OWNER', 'ACTIVE'),
        (${mem2Id}, ${SOCIETY_SUNVIEW_ID}, ${USER_RESIDENT_ID}, 'MEM-2026-002', 'OWNER', 'ACTIVE'),
        (${memTenantId}, ${SOCIETY_SUNVIEW_ID}, ${USER_TENANT_1_ID}, 'MEM-2026-007', 'TENANT', 'ACTIVE');
    `;

    // Family Members & Nominees
    await client`
      INSERT INTO family_members (id, society_id, member_id, name, relation, mobile)
      VALUES 
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${mem1Id}, 'Aarav Sharma', 'Son', '+919000000099'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${mem3Id}, 'Kavita Desai', 'Spouse', '+919000000077'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${mem4Id}, 'Rohan Patel', 'Son', '+919000000066'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${mem2Id}, 'Ananya Singh', 'Spouse', '+919000000088');
    `;

    await client`
      INSERT INTO nominees (id, society_id, member_id, name, relation, share_percentage)
      VALUES 
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${mem1Id}, 'Aarav Sharma', 'Son', '100.00'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${mem3Id}, 'Kavita Desai', 'Spouse', '100.00'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${mem4Id}, 'Rohan Patel', 'Son', '50.00'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${mem2Id}, 'Ananya Singh', 'Spouse', '100.00');
    `;
    console.log('    ✓ Members, Owners, Tenants, Family & Nominees seeded');

    // ==========================================
    // 5. FINANCIAL & ACCOUNTING (Ledgers, Heads, Bills, Receipts)
    // ==========================================
    console.log('  → Creating Financial & Accounting Data...');
    const ledgerBank1Id = uuidv4();
    const ledgerBank2Id = uuidv4();
    const ledgerCashId = uuidv4();
    const ledgerRecId = uuidv4();
    const ledgerFixedAssetId = uuidv4();

    const ledgerSinkingId = uuidv4();
    const ledgerCorpusId = uuidv4();
    const ledgerPayableId = uuidv4();
    const ledgerAdvanceId = uuidv4();
    const ledgerReserveId = uuidv4();

    const ledgerMaintId = uuidv4();
    const ledgerParkingId = uuidv4();
    const ledgerPenaltyId = uuidv4();

    const ledgerExpense1Id = uuidv4();
    const ledgerExpense2Id = uuidv4();
    const ledgerExpense3Id = uuidv4();

    await client`
      INSERT INTO ledgers (id, society_id, name, "group", code, is_active)
      VALUES 
        (${ledgerBank1Id}, ${SOCIETY_SUNVIEW_ID}, 'Bank Account - HDFC Main', 'ASSETS', 'BANK-01', true),
        (${ledgerBank2Id}, ${SOCIETY_SUNVIEW_ID}, 'Bank Account - State Bank of India', 'ASSETS', 'BANK-02', true),
        (${ledgerCashId}, ${SOCIETY_SUNVIEW_ID}, 'Cash in Hand Account', 'ASSETS', 'CASH-01', true),
        (${ledgerRecId}, ${SOCIETY_SUNVIEW_ID}, 'Maintenance Dues Receivables', 'ASSETS', 'REC-01', true),
        (${ledgerFixedAssetId}, ${SOCIETY_SUNVIEW_ID}, 'Society Equipment & Fixed Assets', 'ASSETS', 'AST-01', true),

        (${ledgerSinkingId}, ${SOCIETY_SUNVIEW_ID}, 'Sinking Fund Reserve', 'LIABILITIES', 'RES-01', true),
        (${ledgerCorpusId}, ${SOCIETY_SUNVIEW_ID}, 'Corpus Reserve Fund', 'LIABILITIES', 'RES-02', true),
        (${ledgerPayableId}, ${SOCIETY_SUNVIEW_ID}, 'Vendor & Service Payables', 'LIABILITIES', 'PAY-01', true),
        (${ledgerAdvanceId}, ${SOCIETY_SUNVIEW_ID}, 'Member Advance Maintenance', 'LIABILITIES', 'ADV-01', true),
        (${ledgerReserveId}, ${SOCIETY_SUNVIEW_ID}, 'Accumulated General Reserve Surplus', 'EQUITY', 'EQU-01', true),

        (${ledgerMaintId}, ${SOCIETY_SUNVIEW_ID}, 'Maintenance Charges Income', 'INCOME', 'INC-01', true),
        (${ledgerParkingId}, ${SOCIETY_SUNVIEW_ID}, 'Parking Slot Fee Income', 'INCOME', 'INC-02', true),
        (${ledgerPenaltyId}, ${SOCIETY_SUNVIEW_ID}, 'Non-Occupancy & Penalty Income', 'INCOME', 'INC-03', true),

        (${ledgerExpense1Id}, ${SOCIETY_SUNVIEW_ID}, 'Repairs & Building Maintenance', 'EXPENSES', 'EXP-01', true),
        (${ledgerExpense2Id}, ${SOCIETY_SUNVIEW_ID}, 'Security Guard Agency Expenses', 'EXPENSES', 'EXP-02', true),
        (${ledgerExpense3Id}, ${SOCIETY_SUNVIEW_ID}, 'Electricity & Water Utilities', 'EXPENSES', 'EXP-03', true);
    `;

    await client`
      INSERT INTO bank_accounts (id, society_id, ledger_id, bank_name, account_number, ifsc, branch_name, type, opening_balance, is_default)
      VALUES 
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${ledgerBank1Id}, 'HDFC Bank', '50100012345678', 'HDFC0000042', 'Kharghar Branch', 'SAVINGS', '1500000.00', true),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${ledgerBank2Id}, 'State Bank of India', '30200098765432', 'SBIN0001234', 'Kharghar Sector 21', 'CURRENT', '850000.00', false);
    `;

    const head1Id = uuidv4();
    const head2Id = uuidv4();
    const head3Id = uuidv4();
    const head4Id = uuidv4();
    await client`
      INSERT INTO maintenance_heads (id, society_id, ledger_id, name, description)
      VALUES 
        (${head1Id}, ${SOCIETY_SUNVIEW_ID}, ${ledgerMaintId}, 'Maintenance Charges', 'Monthly operational upkeep fee'),
        (${head2Id}, ${SOCIETY_SUNVIEW_ID}, ${ledgerSinkingId}, 'Sinking Fund', 'Long-term capital reserve fund'),
        (${head3Id}, ${SOCIETY_SUNVIEW_ID}, ${ledgerMaintId}, 'Parking Slot Charges', 'Covered and open vehicle parking fee'),
        (${head4Id}, ${SOCIETY_SUNVIEW_ID}, ${ledgerMaintId}, 'Water Charges', 'Submetered water supply assessment');
    `;

    await client`
      INSERT INTO maintenance_rates (id, society_id, head_id, flat_type, calculation_type, rate)
      VALUES 
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${head1Id}, 'ALL', 'PER_SQFT', '3.50'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${head2Id}, 'ALL', 'FIXED', '500.00'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${head3Id}, 'ALL', 'FIXED', '300.00'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${head4Id}, 'ALL', 'FIXED', '250.00');
    `;

    // Maintenance Bills covering all status scenarios (PAID, UNPAID, PARTIAL, OVERDUE) across 5 flats
    const bill1Id = uuidv4();
    const bill2Id = uuidv4();
    const bill3Id = uuidv4();
    const bill4Id = uuidv4();
    const bill5Id = uuidv4();
    const bill6Id = uuidv4();

    await client`
      INSERT INTO maintenance_bills (id, society_id, flat_id, bill_number, billing_period_start, billing_period_end, due_date, total_amount, status)
      VALUES 
        (${bill1Id}, ${SOCIETY_SUNVIEW_ID}, ${FLAT_101_ID}, 'INV-2026-07-101', '2026-07-01', '2026-07-31', '2026-07-15', '4525.00', 'PAID'),
        (${bill2Id}, ${SOCIETY_SUNVIEW_ID}, ${FLAT_301_ID}, 'INV-2026-07-301', '2026-07-01', '2026-07-31', '2026-07-15', '5575.00', 'UNPAID'),
        (${bill3Id}, ${SOCIETY_SUNVIEW_ID}, ${FLAT_102_ID}, 'INV-2026-07-102', '2026-07-01', '2026-07-31', '2026-07-15', '5575.00', 'PARTIAL'),
        (${bill4Id}, ${SOCIETY_SUNVIEW_ID}, ${FLAT_201_ID}, 'INV-2026-07-201', '2026-07-01', '2026-07-31', '2026-07-15', '4525.00', 'PAID'),
        (${bill5Id}, ${SOCIETY_SUNVIEW_ID}, ${FLAT_302_ID}, 'INV-2026-06-302', '2026-06-01', '2026-06-30', '2026-06-15', '6975.00', 'OVERDUE'),
        (${bill6Id}, ${SOCIETY_SUNVIEW_ID}, ${FLAT_202_ID}, 'INV-2026-07-202', '2026-07-01', '2026-07-31', '2026-07-15', '5575.00', 'UNPAID');
    `;

    await client`
      INSERT INTO bill_items (id, society_id, bill_id, head_id, amount)
      VALUES 
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${bill1Id}, ${head1Id}, '4025.00'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${bill1Id}, ${head2Id}, '500.00'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${bill2Id}, ${head1Id}, '5075.00'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${bill2Id}, ${head2Id}, '500.00'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${bill3Id}, ${head1Id}, '5075.00'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${bill3Id}, ${head2Id}, '500.00'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${bill4Id}, ${head1Id}, '4025.00'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${bill4Id}, ${head2Id}, '500.00'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${bill5Id}, ${head1Id}, '6475.00'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${bill5Id}, ${head2Id}, '500.00');
    `;

    // Payment Receipts covering all payment modes & statuses (CLEARED, BOUNCED, REFUNDED, CANCELLED)
    await client`
      INSERT INTO receipts (id, society_id, bill_id, receipt_number, amount_paid, payment_mode, payment_date, reference_number, status)
      VALUES 
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${bill1Id}, 'REC-2026-0001', '4525.00', 'UPI', '2026-07-10', 'UPI/928374829101', 'CLEARED'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${bill4Id}, 'REC-2026-0002', '4525.00', 'NEFT', '2026-07-12', 'UTR12984719283', 'CLEARED'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${bill3Id}, 'REC-2026-0003', '3000.00', 'CASH', '2026-07-14', 'CASH-REC-#104', 'CLEARED'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${bill5Id}, 'REC-2026-0004', '6975.00', 'CHEQUE', '2026-06-18', 'CHQ-849201 HDFC', 'BOUNCED'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${bill1Id}, 'REC-2026-0005', '500.00', 'CARD', '2026-07-11', 'POS-AUTH-9982', 'REFUNDED');
    `;

    // Vendors & Expenses
    const vendorOtisId = uuidv4();
    const vendorKirloskarId = uuidv4();
    const vendorCleanCorpId = uuidv4();
    const vendorTorrentId = uuidv4();

    await client`
      INSERT INTO vendors (id, society_id, name, contact_person, email, mobile, gstin, pan)
      VALUES 
        (${vendorOtisId}, ${SOCIETY_SUNVIEW_ID}, 'Otis Elevator Company India Ltd.', 'Mr. Rajesh Naik', 'service@otis.co.in', '+919820098200', '27AAACO1234E1Z1', 'AAACO1234E'),
        (${vendorKirloskarId}, ${SOCIETY_SUNVIEW_ID}, 'Kirloskar Brothers Ltd.', 'Mr. Anil Kulkarni', 'support@kirloskar.com', '+919830098300', '27AAACK5678F1Z2', 'AAACK5678F'),
        (${vendorCleanCorpId}, ${SOCIETY_SUNVIEW_ID}, 'CleanCorp Facility Services Pvt Ltd.', 'Ms. Sunita Roy', 'ops@cleancorp.in', '+919840098400', '27AAACC9012G1Z3', 'AAACC9012G'),
        (${vendorTorrentId}, ${SOCIETY_SUNVIEW_ID}, 'Torrent Power Utility Services', 'Helpdesk', 'customercare@torrentpower.com', '+919850098500', '27AAACT3456H1Z4', 'AAACT3456H');
    `;

    const v1Id = uuidv4();
    const v2Id = uuidv4();
    const v3Id = uuidv4();
    await client`
      INSERT INTO vouchers (id, society_id, voucher_number, type, date, narration)
      VALUES 
        (${v1Id}, ${SOCIETY_SUNVIEW_ID}, 'VOU-2026-001', 'PAYMENT', '2026-07-05', 'Paid Elevator Quarterly Maintenance AMC'),
        (${v2Id}, ${SOCIETY_SUNVIEW_ID}, 'VOU-2026-002', 'PAYMENT', '2026-07-15', 'Monthly Common Area Electricity Charges Payout'),
        (${v3Id}, ${SOCIETY_SUNVIEW_ID}, 'VOU-2026-003', 'PAYMENT', '2026-07-20', 'Housekeeping & Gardening Services Contract Payout');
    `;

    await client`
      INSERT INTO transactions (id, society_id, voucher_id, ledger_id, type, amount)
      VALUES 
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${v1Id}, ${ledgerExpense1Id}, 'DEBIT', '12500.00'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${v1Id}, ${ledgerBank1Id}, 'CREDIT', '12500.00'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${v2Id}, ${ledgerExpense3Id}, 'DEBIT', '28400.00'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${v2Id}, ${ledgerBank1Id}, 'CREDIT', '28400.00'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${v3Id}, ${ledgerExpense2Id}, 'DEBIT', '18000.00'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${v3Id}, ${ledgerBank1Id}, 'CREDIT', '18000.00');
    `;

    await client`
      INSERT INTO expenses (id, society_id, voucher_id, vendor_id, bill_number, amount, date, status, approval_status)
      VALUES 
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${v1Id}, ${vendorOtisId}, 'BILL-OTIS-9821', '12500.00', '2026-07-05', 'PAID', 'APPROVED'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${v2Id}, ${vendorTorrentId}, 'BILL-TP-2026-07', '28400.00', '2026-07-15', 'PAID', 'APPROVED'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${v3Id}, ${vendorCleanCorpId}, 'BILL-CC-07-004', '18000.00', '2026-07-20', 'PAID', 'APPROVED'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, null, ${vendorKirloskarId}, 'BILL-KIRL-4820', '8500.00', '2026-07-25', 'UNPAID', 'PENDING');
    `;
    console.log('    ✓ Accounting, Bills, Receipts & Expenses seeded');

    // ==========================================
    // 6. SECURITY & UTILITIES (Parking, Vehicles, Visitors, Staff, Complaints, Assets)
    // ==========================================
    console.log('  → Creating Parking, Vehicles, Visitors, Staff, Complaints & Assets...');
    const park1Id = uuidv4();
    const park2Id = uuidv4();
    const park3Id = uuidv4();
    const park4Id = uuidv4();

    await client`
      INSERT INTO parking_slots (id, society_id, flat_id, slot_number, type, charges)
      VALUES 
        (${park1Id}, ${SOCIETY_SUNVIEW_ID}, ${FLAT_101_ID}, 'P-101 (Basement 1)', 'COVERED', '500.00'),
        (${park2Id}, ${SOCIETY_SUNVIEW_ID}, ${FLAT_301_ID}, 'P-301 (Ground Floor)', 'OPEN', '300.00'),
        (${park3Id}, ${SOCIETY_SUNVIEW_ID}, ${FLAT_201_ID}, 'P-201 (Basement 1)', 'COVERED', '500.00'),
        (${park4Id}, ${SOCIETY_SUNVIEW_ID}, ${FLAT_302_ID}, 'P-302 (Basement 2)', 'RESERVED', '600.00');
    `;

    await client`
      INSERT INTO vehicles (id, society_id, flat_id, parking_slot_id, number, type, make, model)
      VALUES 
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${FLAT_101_ID}, ${park1Id}, 'MH-46-AR-1234', 'FOUR_WHEELER', 'Hyundai', 'Creta'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${FLAT_301_ID}, ${park2Id}, 'MH-46-BZ-5678', 'TWO_WHEELER', 'Honda', 'Activa 6G'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${FLAT_201_ID}, ${park3Id}, 'MH-12-PQ-9988', 'FOUR_WHEELER', 'Toyota', 'Fortuner'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${FLAT_302_ID}, ${park4Id}, 'MH-46-XX-4321', 'FOUR_WHEELER', 'BMW', 'X3');
    `;

    // Visitors logs covering all visitor types & statuses (GUEST, DELIVERY, CAB, WORKER — PENDING, APPROVED, DENIED)
    await client`
      INSERT INTO visitors (id, society_id, flat_id, name, mobile, vehicle_number, type, company, purpose, gate_no, status)
      VALUES 
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${FLAT_101_ID}, 'Suresh Patil (Swiggy)', '+919988776655', 'MH-46-XX-9999', 'DELIVERY', 'Swiggy', 'Food Delivery', 'Gate 1', 'APPROVED'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${FLAT_301_ID}, 'Karan Verma', '+919876500000', 'MH-12-PQ-4321', 'GUEST', 'Personal', 'Visiting Resident', 'Gate 1', 'APPROVED'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${FLAT_201_ID}, 'Ramesh Kumar (Amazon)', '+919811223344', 'MH-46-DL-1122', 'DELIVERY', 'Amazon Courier', 'Parcel Delivery', 'Gate 2', 'PENDING'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${FLAT_102_ID}, 'Sunil Naik (Uber)', '+919822334455', 'MH-14-UB-5566', 'CAB', 'Uber', 'Resident Pickup', 'Gate 1', 'APPROVED'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${FLAT_302_ID}, 'Unknown Visitor', '+919833445566', null, 'GUEST', 'Personal', 'Unannounced Visit', 'Gate 1', 'DENIED');
    `;

    // Staff
    const staff1Id = uuidv4();
    const staff2Id = uuidv4();
    const staff3Id = uuidv4();
    const staff4Id = uuidv4();

    await client`
      INSERT INTO staff (id, society_id, name, mobile, role, salary, is_available)
      VALUES 
        (${staff1Id}, ${SOCIETY_SUNVIEW_ID}, 'Ramesh Chand (Security Guard)', '+919811122233', 'SECURITY', '18000.00', true),
        (${staff2Id}, ${SOCIETY_SUNVIEW_ID}, 'Ganesh Shinde (Electrician)', '+919822233344', 'ELECTRICIAN', '22000.00', true),
        (${staff3Id}, ${SOCIETY_SUNVIEW_ID}, 'Santosh More (Plumber)', '+919833344455', 'PLUMBER', '20000.00', true),
        (${staff4Id}, ${SOCIETY_SUNVIEW_ID}, 'Lata Kamble (Housekeeper)', '+919844455566', 'CLEANER', '15000.00', true);
    `;

    await client`
      INSERT INTO staff_attendance (id, society_id, staff_id, date, check_in, check_out, status)
      VALUES 
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${staff1Id}, '2026-07-26', '2026-07-26T08:00:00Z', '2026-07-26T20:00:00Z', 'PRESENT'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${staff2Id}, '2026-07-26', '2026-07-26T09:00:00Z', '2026-07-26T18:00:00Z', 'PRESENT'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${staff3Id}, '2026-07-26', '2026-07-26T09:30:00Z', '2026-07-26T17:30:00Z', 'PRESENT'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${staff4Id}, '2026-07-26', null, null, 'ABSENT');
    `;

    await client`
      INSERT INTO staff_salaries (id, society_id, staff_id, month, year, base_amount, bonus, deductions)
      VALUES 
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${staff1Id}, 6, 2026, '18000.00', '1000.00', '0.00'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${staff2Id}, 6, 2026, '22000.00', '1500.00', '0.00');
    `;

    // Complaints covering all priorities (LOW, MEDIUM, HIGH, URGENT) and statuses (OPEN, ASSIGNED, RESOLVED, CLOSED)
    await client`
      INSERT INTO complaints (id, society_id, flat_id, raised_by_user_id, assigned_staff_id, title, description, status, priority, escalation_level)
      VALUES 
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${FLAT_301_ID}, ${USER_RESIDENT_ID}, ${staff3Id}, 'Main Bathroom Pipe Leakage', 'Water seepage noticed in the master bedroom attached bathroom ceiling.', 'ASSIGNED', 'HIGH', 0),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${FLAT_101_ID}, ${USER_SECRETARY_ID}, ${staff2Id}, 'Tower A Lift 2 Sensor Error', 'Door sensor trips frequently on floor 3 causing elevator lock.', 'OPEN', 'URGENT', 1),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${FLAT_201_ID}, ${USER_PRESIDENT_ID}, ${staff2Id}, 'Corridor Tube Light Flickering', 'Light fixture outside Flat 201 needs bulb replacement.', 'RESOLVED', 'LOW', 0),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${FLAT_102_ID}, ${USER_TENANT_1_ID}, ${staff4Id}, 'Clubhouse Waste Disposal Bin Overflow', 'Bins near clubhouse entrance require daily clearing.', 'CLOSED', 'MEDIUM', 0);
    `;

    // Capital Assets
    await client`
      INSERT INTO assets (id, society_id, name, type, purchase_date, cost, warranty_expiry, amc_provider, amc_cost, next_service_date)
      VALUES 
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, 'Otis 8-Passenger Elevator (Tower A)', 'LIFT', '2019-03-15', '1450000.00', '2021-03-15', 'Otis Elevator Company India Ltd.', '50000.00', '2026-09-15'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, 'Kirloskar 50HP Main Water Pump', 'PUMP', '2020-06-10', '185000.00', '2022-06-10', 'Kirloskar Brothers Ltd.', '15000.00', '2026-08-30'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, 'Cummins 125kVA Standby Diesel Generator', 'GENERATOR', '2021-01-20', '850000.00', '2023-01-20', 'Cummins India Ltd.', '35000.00', '2026-10-10'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, 'Hikvision 32-Channel IP CCTV System', 'CCTV', '2022-11-05', '320000.00', '2024-11-05', 'SecureEye Tech Systems', '18000.00', '2026-08-15');
    `;
    console.log('    ✓ Parking, Vehicles, Visitors, Staff, Complaints & Assets seeded');

    // ==========================================
    // 7. COMMUNICATION & SETTINGS (Notices, Meetings, Documents, Settings)
    // ==========================================
    console.log('  → Creating Notices, Meetings, Documents & Settings...');
    await client`
      INSERT INTO notices (id, society_id, title, content, type, expires_at)
      VALUES 
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, 'Annual General Meeting (AGM) Notice 2026', 'Notice is hereby given that the 8th Annual General Body Meeting of Sunview Heights CHS Ltd. will be held at the Clubhouse on Sunday, August 10, 2026 at 10:00 AM.', 'MEETING', '2026-08-11T00:00:00Z'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, 'Scheduled Water Tank Cleaning Notice', 'Water supply will be suspended on Wednesday, July 29, 2026 from 9:00 AM to 4:00 PM due to underground tank maintenance.', 'GENERAL', '2026-07-30T00:00:00Z'),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, 'Emergency Power Backup Generator Maintenance', 'Standby DG Generator test run scheduled for July 28, 2026 from 2:00 PM to 3:00 PM. Minor noise expected.', 'EMERGENCY', '2026-07-29T00:00:00Z');
    `;

    const meetingId = uuidv4();
    await client`
      INSERT INTO meetings (id, society_id, title, description, scheduled_at, location, type)
      VALUES (${meetingId}, ${SOCIETY_SUNVIEW_ID}, 'Monthly Managing Committee Meeting', 'Reviewing June financials, audit reports and lift AMC contract renewal.', '2026-07-15T18:30:00Z', 'Clubhouse Hall A', 'COMMITTEE');
    `;

    await client`
      INSERT INTO meeting_minutes (id, society_id, meeting_id, minutes_content)
      VALUES (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${meetingId}, '1. Financial accounts for June 2026 reviewed and passed unanimously.\n2. Approved Rs. 12,500 quarterly payout to Otis Elevators.');
    `;

    await client`
      INSERT INTO documents (id, society_id, name, file_url, file_size, category, is_private)
      VALUES 
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, 'Approved Model Bye-Laws 2026.pdf', 'https://placeholder.supabase.co/storage/v1/object/public/documents/bye-laws.pdf', 2450000, 'BYE_LAW', false),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, 'Financial Audit Report FY2025-26.pdf', 'https://placeholder.supabase.co/storage/v1/object/public/documents/audit-report.pdf', 4120000, 'AUDIT_REPORT', true),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, 'Society Fire Safety NOC Certificate 2026.pdf', 'https://placeholder.supabase.co/storage/v1/object/public/documents/fire-noc.pdf', 1850000, 'CONTRACT', false),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, 'Building Insurance Policy Certificate.pdf', 'https://placeholder.supabase.co/storage/v1/object/public/documents/insurance.pdf', 3100000, 'CONTRACT', true);
    `;

    await client`
      INSERT INTO settings (id, society_id, financial_year_start, billing_frequency, penalty_interest_rate, invoice_due_days, maintenance_formula, calculation_type, per_sqft_rate, flat_rate_same_for_all, per_flat_type_rates)
      VALUES (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, '2026-04-01', 'MONTHLY', '12.00', 15, '(sqft * rate) + fixed_heads', 'PER_SQ_FT', '3.50', '2500.00', '{"1BHK":1500,"2BHK":2500,"3BHK":3500,"Shop":4000}');
    `;

    // ==========================================
    // 8. REAL-TIME IN-APP NOTIFICATIONS SEEDING
    // ==========================================
    console.log('  → Creating In-App Notifications for all user roles...');
    await client`
      INSERT INTO notifications (id, society_id, recipient_user_id, recipient_contact, channel, title, body, status, sent_at)
      VALUES 
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${USER_PRESIDENT_ID}, 'IN_APP', 'IN_APP', '⚠️ New Complaint Raised', 'Flat 301 logged a HIGH priority ticket: "Main Bathroom Pipe Leakage".', 'SENT', NOW()),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${USER_PRESIDENT_ID}, 'IN_APP', 'IN_APP', '📊 Bulk Maintenance Sweeps Complete', 'Generated 6 maintenance invoices for July 2026 cycle.', 'SENT', NOW()),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${USER_SECRETARY_ID}, 'IN_APP', 'IN_APP', '🚨 Complaint Escalated', 'Ticket "Tower A Lift 2 Sensor Error" escalated to Level 1.', 'SENT', NOW()),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${USER_TREASURER_ID}, 'IN_APP', 'IN_APP', '💰 Payment Receipt Logged', 'Receipt REC-2026-0001 for ₹4,525 (UPI) processed for Flat 101.', 'SENT', NOW()),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${USER_ACCOUNTANT_ID}, 'IN_APP', 'IN_APP', '📜 New Voucher Posted', 'Journal Voucher VOU-2026-001 (₹12,500) posted for Otis Elevator AMC.', 'SENT', NOW()),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${USER_ACCOUNTANT_ID}, 'IN_APP', 'IN_APP', '💰 New Payment Receipt Recorded', 'Receipt REC-2026-0002 for ₹4,525 (NEFT) logged for Flat 201.', 'SENT', NOW()),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${USER_RESIDENT_ID}, 'IN_APP', 'IN_APP', '🧾 Maintenance Bill Issued', 'July 2026 invoice INV-2026-07-301 for ₹5,575 is due on 2026-07-15.', 'SENT', NOW()),
        (${uuidv4()}, ${SOCIETY_SUNVIEW_ID}, ${USER_TENANT_1_ID}, 'IN_APP', 'IN_APP', '⚠️ Pending Dues Reminder', 'Maintenance bill INV-2026-07-102 has an outstanding balance of ₹2,575.', 'SENT', NOW());
    `;
    console.log('    ✓ Notices, Meetings, Documents, Settings & Notifications seeded');

    // ==========================================
    // SUMMARY
    // ==========================================
    console.log('\n✅ ALL TABLES SEEDED WITH DEMO DATA SUCCESSFULLY! 🎉\n');

  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  } finally {
    await client.end();
    process.exit(0);
  }
}

seed();
