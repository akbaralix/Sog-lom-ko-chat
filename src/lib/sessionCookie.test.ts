import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SESSION_COOKIE_NAME,
  buildClearSessionCookieHeader,
  buildSessionCookieHeader,
  isHttpsRequest,
  isTrustedMutationOrigin,
  parseCookies,
} from './sessionCookie.ts';

test('parseCookies parses cookie pairs and handles URI-encoded tokens', () => {
  const parsed = parseCookies('foo=bar; sk_session=abc.def%2B123; theme=light');
  assert.equal(parsed.foo, 'bar');
  assert.equal(parsed[SESSION_COOKIE_NAME], 'abc.def+123');
  assert.equal(parsed.theme, 'light');
  assert.deepEqual(parseCookies(undefined), {});
});

test('buildSessionCookieHeader sets SameSite=None; Secure; Partitioned on HTTPS and Lax on local HTTP', () => {
  const httpsCookie = buildSessionCookieHeader('tok.sig', true);
  assert.match(httpsCookie, /^sk_session=tok\.sig;/);
  assert.match(httpsCookie, /HttpOnly/);
  assert.match(httpsCookie, /Secure/);
  assert.match(httpsCookie, /SameSite=None/);
  assert.match(httpsCookie, /Partitioned/);

  const httpCookie = buildSessionCookieHeader('tok.sig', false);
  assert.match(httpCookie, /^sk_session=tok\.sig;/);
  assert.match(httpCookie, /HttpOnly/);
  assert.match(httpCookie, /SameSite=Lax/);
  assert.doesNotMatch(httpCookie, /Secure/);

  const clearedHttps = buildClearSessionCookieHeader(true);
  assert.match(clearedHttps, /^sk_session=;/);
  assert.match(clearedHttps, /Max-Age=0/);
  assert.match(clearedHttps, /SameSite=None/);
});

test('isHttpsRequest detects forwarded HTTPS proxy headers and req.secure', () => {
  assert.equal(isHttpsRequest({ 'x-forwarded-proto': 'https, http' }, false), true);
  assert.equal(isHttpsRequest({ 'x-forwarded-proto': 'http' }, false), false);
  assert.equal(isHttpsRequest({}, true), true);
});

test('isTrustedMutationOrigin allows safe methods, same-origin mutations, and blocks cross-origin POSTs', () => {
  assert.equal(isTrustedMutationOrigin({ method: 'GET', headers: {} }), true);
  assert.equal(
    isTrustedMutationOrigin({
      method: 'POST',
      headers: {
        origin: 'https://example.run.app',
        'x-forwarded-host': 'example.run.app',
      },
    }),
    true,
  );
  assert.equal(
    isTrustedMutationOrigin({
      method: 'POST',
      headers: {
        origin: 'https://evil.example',
        host: 'localhost:3000',
      },
    }),
    false,
  );
  assert.equal(
    isTrustedMutationOrigin({
      method: 'POST',
      headers: {
        'x-requested-with': 'XMLHttpRequest',
      },
    }),
    true,
  );
  assert.equal(
    isTrustedMutationOrigin({
      method: 'POST',
      headers: {},
    }),
    false,
  );
});
