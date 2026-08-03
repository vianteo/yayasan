import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const auth = fs.readFileSync(new URL('../src/Auth.gs', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../src/Api.gs', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../src/Client.html', import.meta.url), 'utf8');
const config = fs.readFileSync(new URL('../src/Config.gs', import.meta.url), 'utf8');

test('user management is restricted to the admin role on the server', () => {
  assert.match(api, /function listUsers\(token\)[\s\S]*requireUser_\(token, \[ROLES\.ADMIN\]\)/);
  assert.match(api, /function saveUser\(token, input\)[\s\S]*requireUser_\(token, \[ROLES\.ADMIN\]\)/);
});

test('user management validates duplicates and protects active administrators', () => {
  assert.match(auth, /Email sudah terdaftar pada pengguna lain/);
  assert.match(auth, /Super Admin tidak dapat menurunkan peran atau menonaktifkan akunnya sendiri/);
  assert.match(auth, /Minimal satu Super Admin harus tetap aktif/);
  assert.match(auth, /addAudit_\('users'/);
});

test('managed user input is normalized and rejects invalid values', () => {
  const context = vm.createContext({});
  vm.runInContext(config + '\n' + auth, context);
  const valid = vm.runInContext("validateManagedUserInput_({email:' Admin@Example.com ',name:' Admin Yayasan ',role:'admin',active:'true'})", context);
  assert.deepEqual({...valid}, {id:'', email:'admin@example.com', name:'Admin Yayasan', role:'ADMIN', active:'TRUE'});
  assert.throws(() => vm.runInContext("validateManagedUserInput_({email:'bukan-email',name:'Pengurus',role:'ADMIN',active:'TRUE'})", context), /Format email tidak valid/);
  assert.throws(() => vm.runInContext("validateManagedUserInput_({email:'user@example.com',name:'Pengurus',role:'PEGAWAI',active:'TRUE'})", context), /Peran pengguna tidak valid/);
  assert.throws(() => vm.runInContext("validateManagedUserInput_({email:'user@example.com',name:'=IMPORTXML(1)',role:'ADMIN',active:'TRUE'})", context), /karakter awal/);
});

test('only admin receives the user-management menu', () => {
  assert.match(client, /data\.user\.role==='ADMIN'[\s\S]*\['users','Kelola Pengguna'\]/);
  assert.match(client, /call\('listUsers',state\.token\)/);
  assert.match(client, /call\('saveUser',state\.token,input\)/);
});
