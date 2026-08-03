import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=JSON.parse(fs.readFileSync(path.join(root,'app.config.json'),'utf8'));
const clasp=path.join(root,'node_modules','.bin','clasp');
const run=(args,options={})=>execFileSync(clasp,args,{cwd:root,encoding:'utf8',stdio:options.capture?'pipe':'inherit'});
if(!fs.existsSync(clasp))throw new Error('Project-local clasp binary not found');
if(run(['--version'],{capture:true}).trim()!=='3.3.0')throw new Error('Expected clasp 3.3.0');
run(['push','--force']);
if(config.deploymentMode==='push-only')process.exit(0);
const marker=config.managedDeploymentDescription;
const raw=run(['--json','list-deployments'],{capture:true});
const parsed=JSON.parse(raw);
const deployments=Array.isArray(parsed)?parsed:(parsed.deployments||[]);
const existing=deployments.find(item=>String(item.description||'').startsWith(marker));
const commit=process.env.GITHUB_SHA||'manual';
const webUrl=item=>(item?.entryPoints||[]).find(entry=>entry.entryPointType==='WEB_APP')?.webApp?.url||'';
if(existing){const id=existing.deploymentId||existing.id;const result=JSON.parse(run(['--json','update-deployment',id,'--description',`${marker} ${commit}`],{capture:true}));console.log(JSON.stringify({action:'updated',deploymentId:id,url:webUrl(result)||webUrl(existing)}));}
else{const result=JSON.parse(run(['--json','create-deployment','--description',`${marker} ${commit}`],{capture:true}));console.log(JSON.stringify({action:'created',deploymentId:result.deploymentId||result.id||'',url:webUrl(result)}));}
