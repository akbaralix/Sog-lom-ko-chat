import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { resolveOrCreateSessionSecret } from './sessionSecret';

test('resolveOrCreateSessionSecret prefers explicit envSecret when >= 16 chars', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-secret-'));
  try {
    const secret = resolveOrCreateSessionSecret({
      envSecret: 'my-super-secure-session-secret-123',
      dataDir: dir,
    });
    assert.equal(secret, 'my-super-secure-session-secret-123');
    assert.equal(fs.existsSync(path.join(dir, '.session_secret')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveOrCreateSessionSecret persists secret across restarts when envSecret is missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-secret-'));
  try {
    const first = resolveOrCreateSessionSecret({ envSecret: '', dataDir: dir });
    const second = resolveOrCreateSessionSecret({ envSecret: undefined, dataDir: dir });
    assert.ok(first.length >= 32);
    assert.equal(first, second);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
