import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ignored=new Set(['node_modules','.git','package-lock.json']);
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>ignored.has(entry.name)?[]:entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);}
const patterns=[
  [/AIza[0-9A-Za-z_-]{30,}/,'Google API key'],
  [/gh[pousr]_[A-Za-z0-9_]{30,}/,'GitHub token'],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,'private key'],
  [/"refresh_token"\s*:/,'OAuth refresh token'],
  [/"client_secret"\s*:/,'OAuth client secret'],
  [/(?:password|token|api_key)\s*=\s*["'][^"'\n]{8,}["']/i,'hardcoded credential'],
];
const findings=[];
for(const file of walk(root)){if(fs.statSync(file).size>1_000_000)continue;const content=fs.readFileSync(file,'utf8');for(const [pattern,label] of patterns)if(pattern.test(content))findings.push(`${path.relative(root,file)}: ${label}`);}
if(findings.length){console.error(findings.join('\n'));process.exit(1);}console.log('Secret scan passed.');
