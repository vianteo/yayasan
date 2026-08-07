import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'app.config.json'), 'utf8'));
const deploySource = fs.readFileSync(path.join(root, 'scripts/deploy.mjs'), 'utf8');
const rollbackSource = fs.readFileSync(path.join(root, 'scripts/rollback.mjs'), 'utf8');

test('deployment produksi menargetkan URL publik yang digunakan yayasan', () => {
  assert.equal(config.managedDeploymentId, 'AKfycbzRFKuvhPtOrnUNvCI5iU415ki-RfH2kF9O_VMXrR3Obd5kXqYUp-YCe2Aizx0wbebI');
  assert.match(deploySource, /config\.managedDeploymentId/);
  assert.match(deploySource, /Configured managed deployment was not found/);
  assert.match(rollbackSource, /config\.managedDeploymentId/);
});
