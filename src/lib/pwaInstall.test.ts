import test from 'node:test';
import assert from 'node:assert/strict';
import { detectInstallPlatform, getInstallInstructionsUz } from './pwaInstall';

test('detectInstallPlatform prioritizes standalone, then deferred prompt, then iOS, then manual browser', () => {
  assert.equal(
    detectInstallPlatform({
      isStandalone: true,
      hasDeferredPrompt: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 14)',
    }),
    'standalone',
  );
  assert.equal(
    detectInstallPlatform({
      isStandalone: false,
      hasDeferredPrompt: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 14)',
    }),
    'android_prompt',
  );
  assert.equal(
    detectInstallPlatform({
      isStandalone: false,
      hasDeferredPrompt: false,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)',
    }),
    'ios_safari',
  );
  assert.equal(
    detectInstallPlatform({
      isStandalone: false,
      hasDeferredPrompt: false,
      userAgent: 'Mozilla/5.0 (Linux; Android 14)',
    }),
    'browser_manual',
  );
});

test('getInstallInstructionsUz returns concise Uzbek steps for iOS and Android browsers', () => {
  const ios = getInstallInstructionsUz('ios_safari');
  assert.ok(ios.title.includes('iPhone'));
  assert.equal(ios.steps.length, 2);

  const android = getInstallInstructionsUz('browser_manual');
  assert.ok(android.title.includes('Android'));
  assert.equal(android.steps.length, 2);
});
