import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const config = fs.readFileSync(new URL('../src/Config.gs', import.meta.url), 'utf8');
const services = fs.readFileSync(new URL('../src/Services.gs', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../src/Api.gs', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../src/Client.html', import.meta.url), 'utf8');

test('client script remains valid JavaScript', () => {
  const source = client.replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');
  assert.doesNotThrow(() => new vm.Script(source));
});

test('reference validation rejects missing and inactive targets', () => {
  const records = {
    PROGRAMS: {
      'PRO-ACTIVE': {id:'PRO-ACTIVE', name:'Program Aktif', status:'ACTIVE'},
      'PRO-OLD': {id:'PRO-OLD', name:'Program Lama', status:'ARCHIVED'},
    },
  };
  const context = vm.createContext({
    findById_: (sheet, id) => records[sheet]?.[id] || null,
  });
  vm.runInContext(config + '\n' + services, context);
  assert.doesNotThrow(() => vm.runInContext("validateEntityReferences_('activities',{program_id:'PRO-ACTIVE'},null)", context));
  assert.throws(() => vm.runInContext("validateEntityReferences_('activities',{program_id:'PRO-MISSING'},null)", context), /tidak ditemukan/);
  assert.throws(() => vm.runInContext("validateEntityReferences_('activities',{program_id:'PRO-OLD'},null)", context), /tidak aktif atau diarsipkan/);
  assert.doesNotThrow(() => vm.runInContext("validateEntityReferences_('activities',{program_id:'PRO-OLD'},{program_id:'PRO-OLD'})", context));
  assert.throws(() => vm.runInContext("validateEntityReferences_('donations',{donor_id:'',program_id:''},null)", context), /Donatur wajib dipilih/);
  assert.doesNotThrow(() => vm.runInContext("validateEntityReferences_('publications',{program_id:''},null)", context));
});

test('reference options show labels and exclude archived records', () => {
  const data = {
    PROGRAMS: [
      {id:'PRO-1',name:'Bahasa Inggris',status:'ACTIVE'},
      {id:'PRO-2',name:'Program Lama',status:'ARCHIVED'},
    ],
    DONORS: [{id:'DNR-1',name:'Budi',email:'budi@example.com',active:'TRUE'}],
    DONATIONS: [{id:'DNS-1',receipt_number:'YBTK-001',donor_id:'DNR-1',received_date:'2026-08-03',status:'TERVERIFIKASI'}],
    PUBLICATIONS: [{id:'PUB-1',title:'Kegiatan Agustus',status:'PUBLISHED'}],
    DISBURSEMENTS: [], BENEFICIARIES: [], SETTINGS: [],
  };
  const context = vm.createContext({
    requireUser_: () => ({email:'admin@example.com',role:'ADMIN'}),
    readAll_: sheet => data[sheet] || [],
  });
  vm.runInContext(config + '\n' + services + '\n' + api, context);
  const options = vm.runInContext("getReferenceOptions('token')", context);
  assert.deepEqual(options.programs.map(item => item.value), ['PRO-1']);
  assert.match(options.programs[0].label, /Bahasa Inggris.*PRO-1/);
  assert.match(options.donations[0].label, /YBTK-001.*Budi.*2026-08-03/);
});

test('relational form fields use selectors and technical IDs are automatic', () => {
  for (const source of ['programs','donors','donations']) {
    assert.match(client, new RegExp("'reference','" + source + "'"));
  }
  assert.match(client, /ID sistem akan dibuat otomatis/);
  assert.match(client, /getReferenceOptions/);
  assert.doesNotMatch(client, /\['program_id','ID program','text'\]/);
  assert.doesNotMatch(client, /\['donor_id','ID donatur','text'\]/);
  assert.doesNotMatch(client, /\['donation_id','ID donasi','text'\]/);
});

test('new entity IDs use distinct readable prefixes', () => {
  const context = vm.createContext({});
  vm.runInContext(config, context);
  const prefixes = vm.runInContext('({...ENTITY_ID_PREFIX})', context);
  assert.deepEqual({...prefixes}, {
    programs:'PRG', activities:'KGT', participants:'PST', beneficiaries:'PMF', donors:'DNR',
    donations:'DNS', donationItems:'DBR', disbursements:'PNY', publications:'PUB', media:'MED',
  });
  assert.match(services, /newId_\(ENTITY_ID_PREFIX\[entity\]/);
});
