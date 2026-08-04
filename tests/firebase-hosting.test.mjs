import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const config = JSON.parse(fs.readFileSync(new URL('../firebase.json', import.meta.url), 'utf8'));

test('Firebase Hosting exposes safe public and internal redirects', () => {
  const redirects = config.hosting.redirects;
  const publicRule = redirects.find(rule => rule.source === '/');
  const internalRule = redirects.find(rule => rule.source === '/pengurus{,/**}');

  assert.equal(publicRule.type, 302);
  assert.equal(internalRule.type, 302);
  assert.equal(new URL(publicRule.destination).hostname, 'script.google.com');
  assert.equal(new URL(internalRule.destination).searchParams.get('page'), 'internal');
  assert.equal(config.hosting.rewrites, undefined);
});
