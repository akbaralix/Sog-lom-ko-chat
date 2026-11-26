import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function resolveOrCreateSessionSecret(params: {
  envSecret?: string;
  dataDir: string;
}): string {
  const fromEnv = (params.envSecret ?? '').trim();
  if (fromEnv.length >= 16) {
    return fromEnv;
  }

  const secretPath = path.resolve(params.dataDir, '.session_secret');
  try {
    if (fs.existsSync(secretPath)) {
      const existing = fs.readFileSync(secretPath, 'utf-8').trim();
      if (existing.length >= 32) {
        return existing;
      }
    }
  } catch {
    // Fall through to generate a fresh secret
  }

  const generated = crypto.randomBytes(32).toString('hex');
  try {
    if (!fs.existsSync(params.dataDir)) {
      fs.mkdirSync(params.dataDir, { recursive: true });
    }
    fs.writeFileSync(secretPath, `${generated}\n`, { encoding: 'utf-8', mode: 0o600 });
  } catch {
    // Non-fatal in read-only test environments
  }
  return generated;
}
