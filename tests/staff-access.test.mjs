import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const api = fs.readFileSync(new URL('../src/Api.gs', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../src/Client.html', import.meta.url), 'utf8');
const config = fs.readFileSync(new URL('../src/Config.gs', import.meta.url), 'utf8');
const services = fs.readFileSync(new URL('../src/Services.gs', import.meta.url), 'utf8');
const staffAccess = fs.readFileSync(new URL('../src/StaffAccess.gs', import.meta.url), 'utf8');

test('staff role is scoped to non-financial program modules', () => {
  assert.match(config, /STAF_PROGRAM:\s*'STAF_PROGRAM'/);
  assert.match(config, /activities:\s*\[[^\]]*ROLES\.STAF_PROGRAM/);
  assert.match(config, /participants:\s*\[[^\]]*ROLES\.STAF_PROGRAM/);
  assert.match(config, /beneficiaries:\s*\[[^\]]*ROLES\.STAF_PROGRAM/);
  assert.match(config, /publications:\s*\[[^\]]*ROLES\.STAF_PROGRAM/);
  assert.doesNotMatch(config, /programs:\s*\[[^\]]*ROLES\.STAF_PROGRAM/);
  for (const entity of ['donors', 'donations', 'donationItems', 'disbursements', 'media']) {
    assert.doesNotMatch(config, new RegExp(`${entity}:\\s*\\[[^\\]]*ROLES\\.STAF_PROGRAM`));
  }
});

test('active program access honors level and date boundaries', () => {
  const context = vm.createContext({});
  vm.runInContext(config + '\n' + staffAccess, context);
  const activeView = vm.runInContext("isProgramAccessCurrentlyActive_({active:'TRUE',access_level:'VIEW',start_date:'2026-08-01',end_date:'2026-08-31'},'2026-08-04')", context);
  const notStarted = vm.runInContext("isProgramAccessCurrentlyActive_({active:'TRUE',access_level:'EDIT',start_date:'2026-08-05'},'2026-08-04')", context);
  const expired = vm.runInContext("isProgramAccessCurrentlyActive_({active:'TRUE',access_level:'EDIT',end_date:'2026-08-03'},'2026-08-04')", context);
  const disabled = vm.runInContext("isProgramAccessCurrentlyActive_({active:'FALSE',access_level:'EDIT'},'2026-08-04')", context);
  assert.equal(activeView, true);
  assert.equal(notStarted, false);
  assert.equal(expired, false);
  assert.equal(disabled, false);
});

test('server filters staff reads and enforces edit assignment on every save', () => {
  assert.match(api, /filterEntityRecordsForUser_\(entity, readAll_\(sheetName\), user\)/);
  assert.match(api, /editableProgramIds:\s*isStaff\s*\?\s*getAssignedProgramIds_\(user, 'EDIT'\)/);
  assert.match(services, /assertStaffCanWriteEntity_\(entity, clean, existing, user\)/);
  assert.match(services, /assertStaffCanReadEntity_\(entity, record, user\)/);
  assert.match(staffAccess, /Staf Program tidak dapat mengubah modul ini secara langsung/);
  assert.match(staffAccess, /Anda tidak memiliki akses EDIT pada Program yang dipilih/);
  assert.match(staffAccess, /Staf Program hanya dapat mengubah publikasi berstatus DRAFT/);
  assert.match(api, /Staf Program tidak dapat mengarsipkan data/);
});

test('only admin manages staff assignments and reviewers decide program requests', () => {
  assert.match(api, /function listProgramAccess\(token\)[\s\S]*requireUser_\(token, \[ROLES\.ADMIN\]\)/);
  assert.match(api, /function saveProgramAccess\(token, input\)[\s\S]*requireUser_\(token, \[ROLES\.ADMIN\]\)/);
  assert.match(api, /function saveProgramChangeRequest\(token, input\)[\s\S]*requireUser_\(token, \[ROLES\.STAF_PROGRAM\]\)/);
  assert.match(api, /function decideProgramChangeRequest\(token, id, decision, reviewNotes\)[\s\S]*ROLES\.SEKRETARIS[\s\S]*ROLES\.KETUA[\s\S]*ROLES\.ADMIN/);
  assert.match(staffAccess, /fields_json:\s*JSON\.stringify\(changedFields\)/);
  assert.match(staffAccess, /request\.status !== 'PENDING_REVIEW'/);
  assert.match(staffAccess, /addApproval_\('PROGRAMS'/);
  assert.match(staffAccess, /addAudit_\('program_change_requests'/);
});

test('staff sheets migrate lazily and client hides write actions for view-only assignments', () => {
  assert.match(staffAccess, /\['USER_PROGRAM_ACCESS', 'PROGRAM_CHANGE_REQUESTS'\]/);
  assert.match(staffAccess, /spreadsheet\.insertSheet\(sheetName\)/);
  assert.match(client, /state\.editableProgramIds=data\.editableProgramIds\|\|\[\]/);
  assert.match(client, /staffCanEdit=!staff\|\|state\.editableProgramIds\.includes/);
  assert.match(client, /\['staffAccess','Akses Staf'\]/);
  assert.match(client, /\['programRequests','Usulan Program'\]/);
  assert.match(client, /Staf Program wajib memilih Program terkait/);
});
