import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAuthHeaders } from './clientSession';

test('buildAuthHeaders sets X-Requested-With and Bearer token when explicitToken is provided', () => {
  const headers = buildAuthHeaders({ 'Content-Type': 'application/json' }, 'tok_abc123456789');
  assert.equal(headers['X-Requested-With'], 'XMLHttpRequest');
  assert.equal(headers['Content-Type'], 'application/json');
  assert.equal(headers.Authorization, 'Bearer tok_abc123456789');
});

test('buildAuthHeaders omits Authorization when no token exists and respects existing Authorization header', () => {
  const withoutToken = buildAuthHeaders({ 'Content-Type': 'application/json' }, null);
  assert.equal(withoutToken.Authorization, undefined);

  const existingAuth = buildAuthHeaders({ Authorization: 'Bearer custom_token' }, 'tok_override');
  assert.equal(existingAuth.Authorization, 'Bearer custom_token');
});
