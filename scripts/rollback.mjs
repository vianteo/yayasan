import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=JSON.parse(fs.readFileSync(path.join(root,'app.config.json'),'utf8'));
const version=Number(process.env.VERSION_NUMBER);
if(!Number.isInteger(version)||version<=0)throw new Error('VERSION_NUMBER must be a positive integer');
if(config.deploymentMode!=='versioned')throw new Error('Rollback requires versioned deployment');
const clasp=path.join(root,'node_modules','.bin','clasp');
const run=(args,options={})=>execFileSync(clasp,args,{cwd:root,encoding:'utf8',stdio:options.capture?'pipe':'inherit'});
if(run(['--version'],{capture:true}).trim()!=='3.3.0')throw new Error('Expected clasp 3.3.0');
const parsed=JSON.parse(run(['--json','list-deployments'],{capture:true}));
const deployments=Array.isArray(parsed)?parsed:(parsed.deployments||[]);
const configuredId=String(config.managedDeploymentId||'').trim();
const existing=configuredId
  ? deployments.find(item=>String(item.deploymentId||item.id||'')===configuredId)
  : deployments.find(item=>String(item.description||'').startsWith(config.managedDeploymentDescription));
if(!existing)throw new Error('Managed deployment not found');
const id=existing.deploymentId||existing.id;
run(['--json','update-deployment',id,'--versionNumber',String(version),'--description',`${config.managedDeploymentDescription} rollback-v${version}`]);
console.log(JSON.stringify({action:'rollback',deploymentId:id,version}));
