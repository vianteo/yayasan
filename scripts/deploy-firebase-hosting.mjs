import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectId = String(process.env.FIREBASE_PROJECT_ID || process.argv[2] || '').trim();
if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
  throw new Error('Provide a valid Firebase project ID using FIREBASE_PROJECT_ID or: npm run deploy:hosting -- PROJECT_ID');
}

const firebaseBinary = path.join(root, '.firebase-cli', 'node_modules', '.bin', process.platform === 'win32' ? 'firebase.cmd' : 'firebase');
fs.accessSync(firebaseBinary, fs.constants.X_OK);

const result = spawnSync(firebaseBinary, ['deploy', '--only', 'hosting', '--project', projectId], {
  cwd: root,
  stdio: 'inherit',
  env: {...process.env, FIREBASE_CLI_DISABLE_UPDATE_CHECK: '1'},
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

console.log(JSON.stringify({
  projectId,
  publicUrl: `https://${projectId}.web.app`,
  internalUrl: `https://${projectId}.web.app/pengurus`,
}, null, 2));
