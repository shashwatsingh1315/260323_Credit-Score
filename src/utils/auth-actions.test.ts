import { describe, it, expect, vi, beforeEach } from 'vitest';
import { switchImpersonationRole, getImpersonationRole } from './auth-actions';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

// Mock Next.js cache and headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock the auth utilities
const mockGetCurrentUser = vi.fn();
vi.mock('./auth', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

describe('auth-actions.ts', () => {
  let mockCookieStore: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock cookie store
    mockCookieStore = {
      get: vi.fn(),
      set: vi.fn(),
    };
    (cookies as any).mockResolvedValue(mockCookieStore);
  });

  describe('switchImpersonationRole', () => {
    it('should set the impersonated_role cookie and revalidate layout', async () => {
      const role = 'rm';

      await switchImpersonationRole(role);

      expect(cookies).toHaveBeenCalled();
      expect(mockCookieStore.set).toHaveBeenCalledWith('impersonated_role', role, { path: '/' });
      expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    });
  });

  describe('getImpersonationRole', () => {
    it('should return founder_admin if no cookie is set and no user is found', async () => {
      mockCookieStore.get.mockReturnValue(undefined);
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await getImpersonationRole();

      expect(result).toBe('founder_admin');
    });

    it('should return the requested role if the user has that role', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'rm' });
      mockGetCurrentUser.mockResolvedValue({ roles: ['rm', 'bdo'] });

      const result = await getImpersonationRole();

      expect(result).toBe('rm');
    });

    it('should return the requested role if the user is a founder_admin', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'rm' });
      mockGetCurrentUser.mockResolvedValue({ roles: ['founder_admin'] });

      const result = await getImpersonationRole();

      expect(result).toBe('rm');
    });

    it('should fallback securely to actual primary role if user does not have requested role', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'board_member' });
      mockGetCurrentUser.mockResolvedValue({ roles: ['kam'] });

      const result = await getImpersonationRole();

      expect(result).toBe('kam');
    });

    it('should fallback to founder_admin if user has no roles and lacks requested role', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'rm' });
      mockGetCurrentUser.mockResolvedValue({ roles: [] });

      const result = await getImpersonationRole();

      expect(result).toBe('founder_admin');
    });

    it('should fallback to founder_admin on error', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'rm' });
      mockGetCurrentUser.mockRejectedValue(new Error('Database error'));

      const result = await getImpersonationRole();

      expect(result).toBe('founder_admin');
    });
  });
});
