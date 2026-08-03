import test from 'node:test';
import assert from 'node:assert/strict';

const isExceptional=(record,threshold)=>Number(record.amount||0)>=threshold||!String(record.evidence_url||'').trim()||record.outside_budget==='TRUE';
const nextChairStatus=(approved,isException)=>approved?(isException?'PENDING_SUPERVISOR':'COMPLETED'):'REJECTED';
const publicSummary=(donations,disbursements)=>({donations:donations.filter(x=>['TERVERIFIKASI','DIALOKASIKAN'].includes(x.status)).reduce((s,x)=>s+Number(x.amount||0),0),disbursements:disbursements.filter(x=>x.status==='COMPLETED').reduce((s,x)=>s+Number(x.amount||0),0)});

test('large, missing-evidence, and outside-budget transactions are exceptional',()=>{assert.equal(isExceptional({amount:10_000_000,evidence_url:'x'},10_000_000),true);assert.equal(isExceptional({amount:1_000,evidence_url:''},10_000_000),true);assert.equal(isExceptional({amount:1_000,evidence_url:'x',outside_budget:'TRUE'},10_000_000),true);assert.equal(isExceptional({amount:1_000,evidence_url:'x'},10_000_000),false);});
test('chair approval routes exceptional transactions to supervisor',()=>{assert.equal(nextChairStatus(true,true),'PENDING_SUPERVISOR');assert.equal(nextChairStatus(true,false),'COMPLETED');assert.equal(nextChairStatus(false,false),'REJECTED');});
test('public summary includes only verified and completed transactions',()=>{assert.deepEqual(publicSummary([{amount:'100',status:'TERVERIFIKASI'},{amount:'50',status:'DRAFT'}],[{amount:'25',status:'COMPLETED'},{amount:'10',status:'PENDING_CHAIR'}]),{donations:100,disbursements:25});});
