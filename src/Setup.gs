function setupProject() {
  const check = healthCheck();
  if (!check.ok) throw new Error('Isi Script Properties terlebih dahulu: ' + check.missingProperties.join(', '));
  const spreadsheet = getSpreadsheet_();
  Object.keys(SHEETS).forEach(function (sheetName) {
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) sheet = spreadsheet.insertSheet(sheetName);
    const headers = SHEETS[sheetName];
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#134e4a').setFontColor('#ffffff');
      sheet.autoResizeColumns(1, headers.length);
    } else {
      const existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
      if (JSON.stringify(existing) !== JSON.stringify(headers)) throw new Error('Header sheet ' + sheetName + ' berbeda dari spesifikasi.');
    }
  });
  seedSettings_();
  setupTriggers();
  return {ok: true, message: 'Struktur aplikasi berhasil disiapkan.', spreadsheetName: spreadsheet.getName()};
}

function seedSettings_() {
  const existing = readAll_('SETTINGS').map(function (item) { return item.key; });
  const defaults = [
    ['ORGANIZATION_NAME', APP.NAME, 'Nama yayasan'],
    ['OFFICIAL_BANK_NAME', OFFICIAL_BANK.NAME, 'Nama bank resmi'],
    ['OFFICIAL_BANK_ACCOUNT_NAME', OFFICIAL_BANK.ACCOUNT_NAME, 'Nama pemilik rekening resmi'],
    ['OFFICIAL_BANK_ACCOUNT_NUMBER', OFFICIAL_BANK.ACCOUNT_NUMBER, 'Nomor rekening resmi'],
    ['PUBLIC_EMAIL', '', 'Email publik'],
    ['PUBLIC_PHONE', '', 'Nomor kontak publik'],
    ['PUBLIC_ADDRESS', '', 'Alamat publik'],
  ];
  defaults.filter(function (item) { return existing.indexOf(item[0]) < 0; }).forEach(function (item) {
    appendRecord_('SETTINGS', {key: item[0], value: item[1], description: item[2], updated_by: 'SYSTEM', updated_at: nowIso_()});
  });
}

function setupTriggers() {
  const managed = ['createScheduledBackup', 'sendPendingApprovalReminders'];
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (managed.indexOf(trigger.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('createScheduledBackup').timeBased().everyDays(1).atHour(2).create();
  ScriptApp.newTrigger('sendPendingApprovalReminders').timeBased().everyDays(1).atHour(8).create();
  return {ok: true};
}

function createScheduledBackup() {
  const spreadsheetId = getRequiredProperty_('PRIMARY_SPREADSHEET_ID');
  const folder = DriveApp.getFolderById(getRequiredProperty_('BACKUP_DRIVE_FOLDER_ID'));
  const source = DriveApp.getFileById(spreadsheetId);
  const name = 'Backup YBTK ' + Utilities.formatDate(new Date(), APP.TIME_ZONE, 'yyyy-MM-dd HHmm');
  try {
    const copy = source.makeCopy(name, folder);
    appendRecord_('BACKUP_LOG', {id: newId_('BKP'), file_id: copy.getId(), file_name: name, status: 'SUCCESS', notes: '', created_at: nowIso_()});
  } catch (error) {
    appendRecord_('BACKUP_LOG', {id: newId_('BKP'), file_id: '', file_name: name, status: 'FAILED', notes: String(error.message || error).slice(0, 300), created_at: nowIso_()});
    throw error;
  }
}

function sendPendingApprovalReminders() {
  readAll_('DISBURSEMENTS').filter(function (item) {
    return ['PENDING_CHAIR', 'PENDING_SUPERVISOR'].indexOf(item.status) >= 0;
  }).forEach(function (item) {
    const role = item.status === 'PENDING_CHAIR' ? ROLES.KETUA : ROLES.PENGAWAS;
    notifyRole_(role, 'Pengingat persetujuan Yayasan', 'Transaksi ' + item.description + ' masih menunggu tindakan.', 'reminder:' + item.id + ':' + Utilities.formatDate(new Date(), APP.TIME_ZONE, 'yyyy-MM-dd'));
  });
}

function authorize() {
  SpreadsheetApp.getActive();
  DriveApp.getRootFolder().getName();
  MailApp.getRemainingDailyQuota();
  return true;
}
