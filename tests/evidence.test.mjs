import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const config = fs.readFileSync(new URL('../src/Config.gs', import.meta.url), 'utf8');
const services = fs.readFileSync(new URL('../src/Services.gs', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../src/Api.gs', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../src/Client.html', import.meta.url), 'utf8');

function evidenceContext() {
  const context = vm.createContext({
    Utilities: {
      base64Decode: value => Array.from(Buffer.from(value, 'base64')),
      formatDate: () => '20260803-150000',
    },
    Date,
  });
  vm.runInContext(config + '\n' + services, context);
  return context;
}

test('evidence validation detects actual JPG, PNG, and PDF signatures', () => {
  const context = evidenceContext();
  assert.equal(vm.runInContext('detectEvidenceMime_([255,216,255,0])', context), 'image/jpeg');
  assert.equal(vm.runInContext('detectEvidenceMime_([137,80,78,71,13,10,26,10])', context), 'image/png');
  assert.equal(vm.runInContext('detectEvidenceMime_([37,80,68,70,45])', context), 'application/pdf');
  assert.equal(vm.runInContext('detectEvidenceMime_([1,2,3,4,5])', context), '');
});

test('evidence validation rejects MIME spoofing and invalid cover files', () => {
  const context = evidenceContext();
  context.jpgBase64 = Buffer.from([255,216,255,0]).toString('base64');
  context.pdfBase64 = Buffer.from('%PDF-test').toString('base64');
  assert.throws(() => vm.runInContext("validateEvidencePayload_({dataBase64:jpgBase64,type:'image/png'},EVIDENCE_UPLOADS.disbursements)", context), /tidak sesuai/);
  assert.throws(() => vm.runInContext("validateEvidencePayload_({dataBase64:pdfBase64,type:'application/pdf'},EVIDENCE_UPLOADS.publications)", context), /tidak diizinkan/);
});

test('evidence filenames are sanitized and Drive IDs are parsed', () => {
  const context = evidenceContext();
  const name = vm.runInContext("buildEvidenceFileName_('disbursements','PNY-123','application/pdf','../../bukti<>.pdf')", context);
  assert.equal(name, '20260803-150000-DISBURSEMENTS-PNY-123-bukti__.pdf');
  assert.equal(vm.runInContext("extractDriveFileId_('https://drive.google.com/file/d/1234567890abcdefghij/view')", context), '1234567890abcdefghij');
});

test('upload API is role-protected and ordinary saves cannot replace evidence URLs', () => {
  assert.match(api, /function saveEntityWithEvidence\(token, entity, input, payload\)[\s\S]*requireUser_\(token, EDIT_ROLES\[entity\]/);
  assert.match(api, /delete safeInput\[evidenceConfig\.field\]/);
  assert.match(api, /function getEvidenceFile\(token, entity, id\)[\s\S]*requireUser_\(token\)/);
  assert.match(services, /if \(!persisted \|\| String\(persisted\[config\.field\][\s\S]*file\.setTrashed\(true\)/);
  assert.match(services, /isFileInDocumentsFolder_/);
});

test('forms use file inputs and expose authenticated evidence previews', () => {
  assert.match(client, /'evidence_url','Bukti pengeluaran','file'/);
  assert.match(client, /'distribution_evidence_url','Bukti penyaluran','file'/);
  assert.match(client, /saveEntityWithEvidence/);
  assert.match(client, /getEvidenceFile/);
  assert.match(client, /data-evidence/);
  assert.doesNotMatch(client, /'evidence_url','Tautan bukti','url'/);
});
