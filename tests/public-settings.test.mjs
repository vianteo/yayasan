import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configSource = fs.readFileSync(path.join(root, 'src/Config.gs'), 'utf8');
const apiSource = fs.readFileSync(path.join(root, 'src/Api.gs'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'src/Index.html'), 'utf8');
const clientSource = fs.readFileSync(path.join(root, 'src/Client.html'), 'utf8');

function createContext(settings) {
  const context = vm.createContext({
    readAll_: sheetName => {
      assert.equal(sheetName, 'SETTINGS');
      return settings;
    },
  });
  vm.runInContext(configSource, context);
  vm.runInContext(apiSource, context);
  return context;
}

test('rekening resmi dipakai ketika SETTINGS masih kosong', () => {
  const context = createContext([]);
  const result = vm.runInContext('getPublicSettings_()', context);
  assert.equal(result.OFFICIAL_BANK_NAME, 'BRI');
  assert.equal(result.OFFICIAL_BANK_ACCOUNT_NAME, 'Yayasan Bina Tali Kasih');
  assert.equal(result.OFFICIAL_BANK_ACCOUNT_NUMBER, '227501001296562');
});

test('nilai SETTINGS nonkosong tetap memprioritaskan konfigurasi pengurus', () => {
  const context = createContext([
    {key: 'OFFICIAL_BANK_NAME', value: 'Bank lain'},
    {key: 'OFFICIAL_BANK_ACCOUNT_NAME', value: ''},
    {key: 'OFFICIAL_BANK_ACCOUNT_NUMBER', value: '  '},
    {key: 'PUBLIC_PHONE', value: '08123456789'},
  ]);
  const result = vm.runInContext('getPublicSettings_()', context);
  assert.equal(result.OFFICIAL_BANK_NAME, 'Bank lain');
  assert.equal(result.OFFICIAL_BANK_ACCOUNT_NAME, 'Yayasan Bina Tali Kasih');
  assert.equal(result.OFFICIAL_BANK_ACCOUNT_NUMBER, '227501001296562');
  assert.equal(result.PUBLIC_PHONE, '08123456789');
});

test('halaman donasi tetap terhubung ke data rekening publik', () => {
  assert.match(indexSource, /id="contactCard"/);
  assert.match(indexSource, /<\?!= include\('Client'\); \?>/);
  assert.match(indexSource, /Konfirmasi donasi ke email: binatalikasih@gmail\.com/);
  assert.match(clientSource, /OFFICIAL_BANK_ACCOUNT_NUMBER/);
  assert.match(clientSource, /getElementById\('contactCard'\)/);
});
