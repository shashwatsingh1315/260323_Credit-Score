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

vi.mock('./supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
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
      mockSingle.mockResolvedValueOnce({ data: null });
      const user = await getCurrentUser();
      expect(user).toBeNull();
    });

    it('returns user profile and roles', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } });
      mockSingle.mockResolvedValueOnce({
        data: { id: 'u1', full_name: 'John Doe', email: 'john@example.com', branch_id: 'b1' }
      });
      mockEq.mockReturnValue({
        then: (resolve: any) => resolve({
          data: [{ role: 'rm' }, { role: 'bdo' }]
        }),
        single: mockSingle,
        select: mockSelect,
        eq: mockEq,
      } as any);

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
      expect(hasRole({ roles: ['rm', 'bdo'] } as any, 'rm')).toBe(true);
    });

    it('returns false if user does not have role', () => {
      expect(hasRole({ roles: ['rm'] } as any, 'kam')).toBe(false);
    });
  });

  describe('hasAnyRole', () => {
    it('returns false if user is null', () => {
      expect(hasAnyRole(null, ['rm', 'kam'])).toBe(false);
    });

    it('returns true if user has at least one matching role', () => {
      expect(hasAnyRole({ roles: ['rm'] } as any, ['rm', 'kam'])).toBe(true);
    });

    it('returns false if user has no matching roles', () => {
      expect(hasAnyRole({ roles: ['bdo'] } as any, ['rm', 'kam'])).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('returns true for founder_admin', () => {
      expect(isAdmin({ roles: ['founder_admin'] } as any)).toBe(true);
    });

    it('returns false for other roles', () => {
      expect(isAdmin({ roles: ['rm'] } as any)).toBe(false);
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
