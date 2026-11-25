import { describe, expect, it } from 'vitest';
import type { TablePermission } from '@vortex/core';
import { decideAccess } from '../src/db/rbac.js';

const userNotesGrant: TablePermission = {
  role: 'user',
  tableName: 'notes',
  canSelect: true,
  canInsert: true,
  canUpdate: true,
  canDelete: true,
  ownerColumn: 'owner_id',
};

const userReadOnly: TablePermission = {
  role: 'user',
  tableName: 'analytics',
  canSelect: true,
  canInsert: false,
  canUpdate: false,
  canDelete: false,
  ownerColumn: null,
};

const wildcardGrant: TablePermission = {
  role: 'service',
  tableName: '*',
  canSelect: true,
  canInsert: true,
  canUpdate: true,
  canDelete: false,
  ownerColumn: null,
};

describe('decideAccess', () => {
  it('grants admin unrestricted access', () => {
    const d = decideAccess([], 'admin', 'secrets', 'delete', 'admin-1');
    expect(d.allowed).toBe(true);
    expect(d.ownerColumn).toBeNull();
  });

  it('denies roles without any grant', () => {
    const d = decideAccess([userNotesGrant], 'guest', 'notes', 'select', 'g-1');
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain('no grant');
  });

  it('allows the granted action and reports the owner scope', () => {
    const d = decideAccess([userNotesGrant], 'user', 'notes', 'update', 'u-1');
    expect(d.allowed).toBe(true);
    expect(d.ownerColumn).toBe('owner_id');
  });

  it('denies actions that are not enabled', () => {
    const d = decideAccess([userReadOnly], 'user', 'analytics', 'insert', 'u-1');
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain('cannot insert');
  });

  it('honors wildcard table grants', () => {
    const d = decideAccess([wildcardGrant], 'service', 'anything_at_all', 'select', 's-1');
    expect(d.allowed).toBe(true);
    const denied = decideAccess([wildcardGrant], 'service', 'anything_at_all', 'delete', 's-1');
    expect(denied.allowed).toBe(false);
  });

  it('prefers an exact table match over a wildcard', () => {
    const exact: TablePermission = { ...wildcardGrant, tableName: 'notes', canDelete: true };
    const d = decideAccess([wildcardGrant, exact], 'service', 'notes', 'delete', 's-1');
    expect(d.allowed).toBe(true);
    expect(d.ownerColumn).toBeNull();
  });
});
