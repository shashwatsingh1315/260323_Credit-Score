import { describe, it, expect } from 'vitest';
import { hasRole, hasAnyRole, isAdmin, UserProfile, UserRole } from '@/utils/auth';

describe('auth utils', () => {
  const createUser = (roles: UserRole[]): UserProfile => ({
    id: 'test-id',
    full_name: 'Test User',
    email: 'test@example.com',
    branch_id: null,
    roles,
  });

  describe('hasRole', () => {
    it('returns false if user is null', () => {
      expect(hasRole(null, 'rm')).toBe(false);
    });

    it('returns true if user has the specific role', () => {
      const user = createUser(['rm', 'kam']);
      expect(hasRole(user, 'rm')).toBe(true);
      expect(hasRole(user, 'kam')).toBe(true);
    });

    it('returns false if user does not have the specific role', () => {
      const user = createUser(['rm']);
      expect(hasRole(user, 'kam')).toBe(false);
    });
  });

  describe('hasAnyRole', () => {
    it('returns false if user is null', () => {
      expect(hasAnyRole(null, ['rm', 'kam'])).toBe(false);
    });

    it('returns true if user has at least one of the roles', () => {
      const user = createUser(['rm', 'bdo']);
      expect(hasAnyRole(user, ['kam', 'bdo'])).toBe(true);
    });

    it('returns false if user has none of the roles', () => {
      const user = createUser(['rm']);
      expect(hasAnyRole(user, ['kam', 'bdo'])).toBe(false);
    });

    it('returns false for empty roles array if user has roles', () => {
      const user = createUser(['rm']);
      expect(hasAnyRole(user, [])).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('returns false if user is null', () => {
      expect(isAdmin(null)).toBe(false);
    });

    it('returns true if user has founder_admin role', () => {
      const user = createUser(['founder_admin']);
      expect(isAdmin(user)).toBe(true);
    });

    it('returns false if user does not have founder_admin role', () => {
      const user = createUser(['board_member']);
      expect(isAdmin(user)).toBe(false);
    });
  });
});
