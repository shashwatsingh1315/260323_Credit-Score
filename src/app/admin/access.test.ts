import { describe, it, expect, vi, beforeEach } from 'vitest';

type TestUser = {
  id: string;
  full_name: string;
  email: string;
  branch_id: null;
  roles: string[];
};

type DbResult = { data: unknown; error: unknown };

const h = vi.hoisted(() => ({
  currentUser: null as TestUser | null,
  dbResult: { data: null, error: null } as DbResult,
  dbTouched: vi.fn(),
}));

vi.mock('@/utils/auth', () => ({
  getCurrentUser: vi.fn(async () => h.currentUser),
  isAdmin: (u: TestUser | null) => !!u?.roles?.includes('founder_admin'),
  hasAnyRole: (u: TestUser | null, roles: string[]) => !!u && roles.some(r => u.roles.includes(r)),
  logAuditEvent: vi.fn(async () => undefined),
}));

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => {
    h.dbTouched();
    const chain = (): Record<string, unknown> => {
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'neq', 'or', 'in', 'ilike', 'delete', 'update', 'insert', 'upsert', 'order', 'limit', 'single', 'maybeSingle']) {
        b[m] = vi.fn(() => b);
      }
      b.then = (res: (v: DbResult) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(h.dbResult).then(res, rej);
      return b;
    };
    return { from: vi.fn(() => chain()) };
  }),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn((to: string) => { throw new Error(`REDIRECT:${to}`); }) }));
vi.mock('@/utils/preapproval', () => ({ refreshPreapprovedBand: vi.fn() }));
vi.mock('@/utils/engine', () => ({ calculateCompositeDays: vi.fn() }));

import { fetchParties, revokeRole, adminDeleteUser, fetchActiveRoster, fetchGlobalAuditLog } from './actions';
import { processImportJob, fetchImportJobs } from './imports/actions';
import { handleMergeParties, fetchPartiesWithAliases } from './aliases/actions';

const rmUser: TestUser = { id: 'rm-1', full_name: 'RM', email: 'rm@x.test', branch_id: null, roles: ['rm'] };
const kamUser: TestUser = { id: 'kam-1', full_name: 'KAM', email: 'kam@x.test', branch_id: null, roles: ['kam'] };
const admin: TestUser = { id: 'admin-1', full_name: 'Admin', email: 'admin@x.test', branch_id: null, roles: ['founder_admin'] };

function formOf(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  h.currentUser = null;
  h.dbResult = { data: null, error: null };
  h.dbTouched.mockClear();
});

describe('admin server actions reject non-admin callers before touching the database', () => {
  it('processImportJob rejects an RM', async () => {
    h.currentUser = rmUser;
    await expect(processImportJob(formOf({ import_type: 'party_master', payload: '[]' })))
      .rejects.toThrow(/Only Admin/);
    expect(h.dbTouched).not.toHaveBeenCalled();
  });

  it('fetchImportJobs rejects a KAM', async () => {
    h.currentUser = kamUser;
    await expect(fetchImportJobs()).rejects.toThrow(/Only Admin/);
    expect(h.dbTouched).not.toHaveBeenCalled();
  });

  it('handleMergeParties rejects an RM', async () => {
    h.currentUser = rmUser;
    await expect(handleMergeParties(formOf({ primary_id: 'a', duplicate_id: 'b' })))
      .rejects.toThrow(/Only Admin/);
    expect(h.dbTouched).not.toHaveBeenCalled();
  });

  it('fetchPartiesWithAliases rejects an RM', async () => {
    h.currentUser = rmUser;
    await expect(fetchPartiesWithAliases()).rejects.toThrow(/Only Admin/);
    expect(h.dbTouched).not.toHaveBeenCalled();
  });

  it('fetchParties and fetchActiveRoster reject a KAM', async () => {
    h.currentUser = kamUser;
    await expect(fetchParties()).rejects.toThrow(/Only Admin/);
    await expect(fetchActiveRoster()).rejects.toThrow(/Only Admin/);
    expect(h.dbTouched).not.toHaveBeenCalled();
  });

  it('fetchGlobalAuditLog rejects an RM', async () => {
    h.currentUser = rmUser;
    await expect(fetchGlobalAuditLog()).rejects.toThrow(/Only Admin/);
    expect(h.dbTouched).not.toHaveBeenCalled();
  });
});

describe('revokeRole last-founder guard', () => {
  it('blocks removing the only founder_admin', async () => {
    h.currentUser = admin;
    h.dbResult = { data: [{ user_id: 'admin-1' }], error: null };
    const res = await revokeRole(formOf({ userId: 'admin-1', role: 'founder_admin' }));
    expect(res).toMatchObject({ success: false, error: expect.stringMatching(/last Founder Admin/) });
  });

  it('allows removing a founder_admin when another founder exists', async () => {
    h.currentUser = admin;
    h.dbResult = { data: [{ user_id: 'admin-1' }, { user_id: 'admin-2' }], error: null };
    const res = await revokeRole(formOf({ userId: 'admin-1', role: 'founder_admin' }));
    expect(res.success).toBe(true);
  });

  it('does not apply the founder guard to other roles', async () => {
    h.currentUser = admin;
    h.dbResult = { data: [{ user_id: 'admin-1' }], error: null };
    const res = await revokeRole(formOf({ userId: 'admin-1', role: 'kam' }));
    expect(res.success).toBe(true);
  });
});

describe('adminDeleteUser guards', () => {
  it('refuses to delete the signed-in admin', async () => {
    h.currentUser = admin;
    const res = await adminDeleteUser(formOf({ userId: 'admin-1', confirmText: 'admin@x.test' }));
    expect(res).toMatchObject({ success: false, error: expect.stringMatching(/own account/) });
    expect(h.dbTouched).not.toHaveBeenCalled();
  });
});
