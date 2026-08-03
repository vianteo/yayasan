import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const code = fs.readFileSync(new URL('../src/Code.gs', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../src/Index.html', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../src/Client.html', import.meta.url), 'utf8');

test('top-level navigation uses absolute configured URLs', () => {
  assert.match(code, /template\.publicAppUrl/);
  assert.match(code, /template\.internalAppUrl/);
  assert.match(index, /href="<\?= publicAppUrl \?>"/);
  assert.equal((index.match(/href="<\?= internalAppUrl \?>"/g) || []).length, 2);
  assert.doesNotMatch(index, /href="\?page=/);
  assert.doesNotMatch(client, /location\.href='\?page=/);
});
