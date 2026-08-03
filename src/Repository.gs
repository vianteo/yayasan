function getSpreadsheet_() {
  return SpreadsheetApp.openById(getRequiredProperty_('PRIMARY_SPREADSHEET_ID'));
}

function getSheet_(name) {
  const sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('Sheet belum tersedia: ' + name);
  return sheet;
}

function readAll_(sheetName) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(function (row) {
    return row.some(function (value) { return value !== ''; });
  }).map(function (row) {
    return headers.reduce(function (record, header, index) {
      record[header] = row[index];
      return record;
    }, {});
  });
}

function findById_(sheetName, id) {
  return readAll_(sheetName).find(function (record) { return record.id === String(id); }) || null;
}

function appendRecord_(sheetName, record) {
  const headers = SHEETS[sheetName];
  if (!headers) throw new Error('Konfigurasi sheet tidak dikenal.');
  getSheet_(sheetName).appendRow(headers.map(function (header) {
    const value = record[header];
    return value === undefined || value === null ? '' : value;
  }));
  return record;
}

function upsertRecord_(sheetName, record) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = getSheet_(sheetName);
    const values = sheet.getDataRange().getValues();
    const headers = values[0].map(String);
    const idIndex = headers.indexOf('id');
    let rowIndex = -1;
    if (record.id && idIndex >= 0) {
      for (let index = 1; index < values.length; index += 1) {
        if (String(values[index][idIndex]) === String(record.id)) {
          rowIndex = index + 1;
          break;
        }
      }
    }
    const row = headers.map(function (header) {
      if (Object.prototype.hasOwnProperty.call(record, header)) return record[header];
      if (rowIndex > 0) return values[rowIndex - 1][headers.indexOf(header)];
      return '';
    });
    if (rowIndex > 0) sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
    else sheet.appendRow(row);
    return headers.reduce(function (output, header, index) {
      output[header] = row[index];
      return output;
    }, {});
  } finally {
    lock.releaseLock();
  }
}

function addAudit_(entity, entityId, action, user, detail) {
  appendRecord_('AUDIT_LOG', {
    id: newId_('AUD'), entity: entity, entity_id: entityId, action: action,
    actor_email: user.email, actor_role: user.role,
    detail_json: JSON.stringify(detail || {}), created_at: nowIso_(),
  });
}

function addApproval_(entity, entityId, stage, decision, notes, user) {
  appendRecord_('APPROVALS', {
    id: newId_('APR'), entity: entity, entity_id: entityId, stage: stage,
    decision: decision, notes: notes || '', actor_email: user.email,
    actor_role: user.role, created_at: nowIso_(),
  });
}
