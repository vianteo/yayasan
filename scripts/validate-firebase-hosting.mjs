import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const fail = message => { throw new Error(message); };

const firebase = readJson('firebase.json');
const pkg = readJson('package.json');
const hosting = firebase.hosting;

if (!hosting || hosting.public !== 'hosting') fail('Firebase Hosting public directory must be hosting');
if (pkg.scripts?.['setup:firebase-hosting'] !== 'bash scripts/setup-firebase-hosting.sh') fail('Firebase setup script contract invalid');
if (pkg.scripts?.['deploy:hosting'] !== 'node scripts/deploy-firebase-hosting.mjs') fail('Firebase deploy script contract invalid');
if (!fs.existsSync(path.join(root, 'hosting', '404.html'))) fail('Firebase Hosting 404 page is required');
fs.accessSync(path.join(root, 'scripts', 'setup-firebase-hosting.sh'), fs.constants.X_OK);
const setup = fs.readFileSync(path.join(root, 'scripts', 'setup-firebase-hosting.sh'), 'utf8');
for (const requirement of ['firebase-tools@15.25.1', 'login --no-localhost', 'projects:create', 'deploy-firebase-hosting.mjs']) {
  if (!setup.includes(requirement)) fail(`Firebase setup is missing: ${requirement}`);
}

const redirects = Array.isArray(hosting.redirects) ? hosting.redirects : [];
const publicRedirect = redirects.find(rule => rule.source === '/');
const internalRedirect = redirects.find(rule => rule.source === '/pengurus{,/**}');
for (const [label, rule] of [['public', publicRedirect], ['internal', internalRedirect]]) {
  if (!rule) fail(`Missing ${label} redirect`);
  if (rule.type !== 302) fail(`${label} redirect must use temporary HTTP 302`);
  const target = new URL(rule.destination);
  if (target.protocol !== 'https:' || target.hostname !== 'script.google.com') fail(`${label} redirect must target Apps Script over HTTPS`);
  if (!/^\/macros\/s\/[^/]+\/exec$/.test(target.pathname)) fail(`${label} redirect must target a deployed Apps Script /exec URL`);
}
if (new URL(publicRedirect.destination).search) fail('Public redirect must not contain query parameters');
if (new URL(internalRedirect.destination).searchParams.get('page') !== 'internal') fail('Internal redirect must set page=internal');
if ('rewrites' in hosting) fail('Firebase rewrites are not permitted for the Apps Script redirect architecture');

console.log('Firebase Hosting redirects validated.');
