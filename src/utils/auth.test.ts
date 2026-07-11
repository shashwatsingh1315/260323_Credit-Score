import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCurrentUser,
  hasRole,
  hasAnyRole,
  isAdmin,
  logAuditEvent
} from './auth';

const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();

let mockGetSession = vi.fn(() => Promise.resolve({ data: { session: null } }));

vi.mock('./supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
      getSession: mockGetSession,
    },
    from: vi.fn(() => {
      const builder = {
        select: vi.fn().mockImplementation((...args) => {
          mockSelect(...args);
          return builder;
        }),
        eq: vi.fn().mockImplementation((...args) => {
          const res = mockEq(...args);
          if (res) return res;
          return builder;
        }),
        single: vi.fn().mockImplementation((...args) => {
          return mockSingle(...args);
        }),
        insert: vi.fn().mockImplementation((...args) => {
          mockInsert(...args);
          return builder;
        }),
      };
      return builder;
    }),
  })),
}));

describe('auth.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockReset();
    mockSelect.mockReset();
    mockEq.mockReset();
    mockSingle.mockReset();
    mockInsert.mockReset();
  });

  describe('getCurrentUser', () => {
    it('returns null if not authenticated', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });
      const user = await getCurrentUser();
      expect(user).toBeNull();
    });

    it('returns null if profile not found', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } });
      mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' } } } });
      mockSingle.mockResolvedValueOnce({ data: null });
      const user = await getCurrentUser();
      expect(user).toBeNull();
    });

    it('returns user profile and roles', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } });
      mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' } } } });
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'u1',
          full_name: 'John Doe',
          email: 'john@example.com',
          branch_id: 'b1',
          user_roles: [{ role: 'rm' }, { role: 'bdo' }]
        }
      });

      const user = await getCurrentUser();
      expect(user).toEqual({
        id: 'u1',
        full_name: 'John Doe',
        email: 'john@example.com',
        branch_id: 'b1',
        roles: ['rm', 'bdo'],
      });
    });
  });

  describe('hasRole', () => {
    it('returns false if user is null', () => {
      expect(hasRole(null, 'rm')).toBe(false);
    });

    it('returns true if user has exact role', () => {
      expect(hasRole({ id: 'u1', full_name: 'John Doe', email: 'john@example.com', roles: ['rm', 'bdo'] }, 'rm')).toBe(true);
    });

    it('returns false if user does not have role', () => {
      expect(hasRole({ id: 'u1', full_name: 'John Doe', email: 'john@example.com', roles: ['rm'] }, 'kam')).toBe(false);
    });
  });

  describe('hasAnyRole', () => {
    it('returns false if user is null', () => {
      expect(hasAnyRole(null, ['rm', 'kam'])).toBe(false);
    });

    it('returns true if user has at least one matching role', () => {
      expect(hasAnyRole({ id: 'u1', full_name: 'John Doe', email: 'john@example.com', roles: ['rm'] }, ['rm', 'kam'])).toBe(true);
    });

    it('returns false if user has no matching roles', () => {
      expect(hasAnyRole({ id: 'u1', full_name: 'John Doe', email: 'john@example.com', roles: ['bdo'] }, ['rm', 'kam'])).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('returns true for founder_admin', () => {
      expect(isAdmin({ id: 'u1', full_name: 'John Doe', email: 'john@example.com', roles: ['founder_admin'] })).toBe(true);
    });

    it('returns false for other roles', () => {
      expect(isAdmin({ id: 'u1', full_name: 'John Doe', email: 'john@example.com', roles: ['rm'] })).toBe(false);
    });
  });

  describe('logAuditEvent', () => {
    it('inserts audit event correctly', async () => {
      mockInsert.mockResolvedValueOnce({ error: null });

      await logAuditEvent({
        event_type: 'test_event',
        description: 'Testing audit'
      });

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        event_type: 'test_event',
        description: 'Testing audit'
      }));
    });
  });
});
