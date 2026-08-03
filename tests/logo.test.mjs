import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const index = fs.readFileSync(new URL('../src/Index.html', import.meta.url), 'utf8');
const logo = fs.readFileSync(new URL('../assets/ybtk-logo.png', import.meta.url));

test('official logo is valid, optimized, and used in both app shells', () => {
  assert.deepEqual([...logo.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(logo.length < 300_000);
  assert.equal((index.match(/assets\/ybtk-logo\.png/g) || []).length, 2);
  assert.doesNotMatch(index, /class="brand-mark">Y</);
});
