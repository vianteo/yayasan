import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const readJson=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const fail=message=>{throw new Error(message);};
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);

const config=readJson('app.config.json');
const manifest=readJson('src/appsscript.json');
const devcontainer=readJson('.devcontainer/devcontainer.json');
const pkg=readJson('package.json');

if(config.schemaVersion!==1)fail('app.config.json schemaVersion must be 1');
if(!['webapp','automation','bound-script','workspace-addon'].includes(config.projectType))fail('Invalid projectType');
if(!['none','sheets','properties','cloud-sql','firestore-rest','bigquery','external-rest'].includes(config.dataStore))fail('Invalid dataStore');
if(config.projectType==='webapp'&&config.deploymentMode!=='versioned')fail('Web apps require versioned deployment');
if(!config.requiredScriptProperties.every(name=>/^[A-Z][A-Z0-9_]*$/.test(name)))fail('Script Property names must use UPPER_SNAKE_CASE');
if(config.privilegedOperationsApproved!==false)fail('Privileged operations are not approved');
if(manifest.runtimeVersion!=='V8')fail('Apps Script V8 is required');
if(manifest.timeZone!=='Asia/Jakarta')fail('Explicit Asia/Jakarta time zone required');
if(!Array.isArray(manifest.oauthScopes)||!manifest.oauthScopes.length)fail('Explicit OAuth scopes required');
if(!manifest.webapp||!manifest.webapp.access||!manifest.webapp.executeAs)fail('Explicit webapp policy required');
if(!devcontainer.features?.['ghcr.io/devcontainers/features/github-cli:1'])fail('GitHub CLI devcontainer feature required');
if(pkg.devDependencies?.['@google/clasp']!=='3.3.0')fail('Exact @google/clasp 3.3.0 required');
if(pkg.scripts?.['setup:apps-script']!=='bash scripts/setup-apps-script.sh')fail('setup:apps-script contract invalid');

const gsFiles=walk(path.join(root,'src')).filter(file=>file.endsWith('.gs'));
for(const file of gsFiles){const source=fs.readFileSync(file,'utf8');if(/\beval\s*\(|new\s+Function\s*\(/.test(source))fail(`Unsafe dynamic code in ${path.relative(root,file)}`);new vm.Script(source,{filename:file});}
const code=gsFiles.map(file=>fs.readFileSync(file,'utf8')).join('\n');
if(!/function\s+doGet\s*\(/.test(code))fail('Web app requires doGet');
if(!/function\s+healthCheck\s*\(/.test(code))fail('healthCheck required');

const bootstrap=fs.readFileSync(path.join(root,'scripts/setup-apps-script.sh'),'utf8');
for(const pattern of ['env -u GH_TOKEN -u GITHUB_TOKEN gh','actions/secrets/public-key','CODESPACES','node_modules/.bin/clasp','.clasp.json','CLASPRC_JSON','CLASP_JSON'])if(!bootstrap.includes(pattern))fail(`Bootstrap missing contract: ${pattern}`);
fs.accessSync(path.join(root,'scripts/setup-apps-script.sh'),fs.constants.X_OK);
console.log(`Validated ${gsFiles.length} Apps Script files and repository contract.`);
