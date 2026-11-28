/** Staff who only work the gate: they get the guard screens instead of the resident tabs. */
export const GUARD_ONLY = ['SECURITY_SUPERVISOR'];
/** Everyone the backend lets use the gate desk (it checks again on every call). */
export const GATE_ROLES = ['SECURITY_SUPERVISOR', 'ESTATE_MANAGER', 'SUPER_ADMIN', 'SOCIETY_ADMIN', 'PRESIDENT', 'SECRETARY'];

export const isGuardOnly = (role?: string | null) => !!role && GUARD_ONLY.includes(role);
export const canUseGate = (role?: string | null) => !!role && GATE_ROLES.includes(role);
