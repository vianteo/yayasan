function validateEntity_(entity, input) {
  const requiredByEntity = {
    programs: ['name', 'category'], activities: ['program_id', 'title', 'activity_date'],
    participants: ['program_id', 'name', 'identity_key'], beneficiaries: ['program_id', 'name', 'identity_key'],
    donors: ['name', 'type'], donations: ['donor_id', 'donation_type', 'received_date'],
    donationItems: ['donation_id', 'item_name', 'quantity'],
    disbursements: ['program_id', 'transaction_date', 'description', 'amount', 'recipient'],
    publications: ['type', 'title', 'summary'], media: ['publication_id', 'file_url'],
  };
  const missing = (requiredByEntity[entity] || []).filter(function (key) {
    return input[key] === undefined || input[key] === null || String(input[key]).trim() === '';
  });
  if (missing.length) throw new Error('Data wajib belum diisi: ' + missing.join(', '));
  if (['donations', 'disbursements'].indexOf(entity) >= 0 && Number(input.amount || 0) < 0) {
    throw new Error('Nilai transaksi tidak boleh negatif.');
  }
}

function sanitizeRecord_(input) {
  const output = {};
  Object.keys(input || {}).forEach(function (key) {
    if (['__proto__', 'constructor', 'prototype', 'role', 'created_by', 'updated_by'].indexOf(key) < 0) {
      output[key] = typeof input[key] === 'string' ? input[key].trim() : input[key];
    }
  });
  return output;
}

function saveEntity_(entity, input, user) {
  const sheetName = ENTITY_TO_SHEET[entity];
  if (!sheetName) throw new Error('Modul tidak dikenal.');
  const now = nowIso_();
  const clean = sanitizeRecord_(input || {});
  const existing = clean.id ? findById_(sheetName, clean.id) : null;
  validateEntityReferences_(entity, clean, existing);
  validateEntity_(entity, clean);
  const record = Object.assign({}, existing || {}, clean, {
    id: clean.id || newId_(ENTITY_ID_PREFIX[entity] || sheetName.slice(0, 3)),
    created_by: existing ? existing.created_by : user.email,
    created_at: existing ? existing.created_at : now,
    updated_by: user.email,
    updated_at: now,
  });
  if (!record.status) record.status = entity === 'publications' ? 'DRAFT' : 'ACTIVE';
  if (entity === 'donations' && !record.receipt_number) {
    record.receipt_number = 'YBTK-' + Utilities.formatDate(new Date(), APP.TIME_ZONE, 'yyyyMMdd') + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
  }
  if (entity === 'disbursements') {
    record.status = existing ? existing.status : 'DRAFT';
    record.is_exception = isExceptionalDisbursement_(record) ? 'TRUE' : 'FALSE';
  }
  const saved = upsertRecord_(sheetName, record);
  addAudit_(entity, saved.id, existing ? 'UPDATE' : 'CREATE', user, {status: saved.status});
  return saved;
}

function validateEntityReferences_(entity, input, existing) {
  const rules = ENTITY_REFERENCES[entity] || {};
  Object.keys(rules).forEach(function (field) {
    const rule = rules[field];
    const value = String(input[field] || '').trim();
    if (!value) {
      if (rule.required) throw new Error(rule.label + ' wajib dipilih.');
      return;
    }
    const target = findById_(rule.sheet, value);
    if (!target) throw new Error(rule.label + ' yang dipilih tidak ditemukan.');
    const unchangedExistingReference = existing && String(existing[field] || '') === value;
    if (!isReferenceActive_(target) && !unchangedExistingReference) {
      throw new Error(rule.label + ' yang dipilih sudah tidak aktif atau diarsipkan.');
    }
  });
}

function isReferenceActive_(record) {
  if (!record) return false;
  if (String(record.status || '').toUpperCase() === 'ARCHIVED') return false;
  if (String(record.active || '').toUpperCase() === 'FALSE') return false;
  return true;
}

function saveEntityWithEvidence_(entity, input, payload, user) {
  const config = EVIDENCE_UPLOADS[entity];
  const sheetName = ENTITY_TO_SHEET[entity];
  if (!config || !sheetName) throw new Error('Modul ini tidak mendukung unggah file.');
  const prepared = Object.assign({}, input || {});
  const existing = prepared.id ? findById_(sheetName, prepared.id) : null;
  if (prepared.id && !existing) throw new Error('Data tidak ditemukan. Muat ulang halaman dan coba lagi.');
  if (!prepared.id) prepared.id = newId_(ENTITY_ID_PREFIX[entity] || sheetName.slice(0, 3));
  const validated = validateEvidencePayload_(payload, config);
  const folder = DriveApp.getFolderById(getRequiredProperty_('DOCUMENTS_DRIVE_FOLDER_ID'));
  const fileName = buildEvidenceFileName_(entity, prepared.id, validated.mimeType, payload.name);
  const file = folder.createFile(Utilities.newBlob(validated.bytes, validated.mimeType, fileName));
  const fileUrl = file.getUrl();
  try {
    prepared[config.field] = fileUrl;
    const saved = saveEntity_(entity, prepared, user);
    addAudit_(entity, saved.id, existing && existing[config.field] ? 'EVIDENCE_REPLACE' : 'EVIDENCE_UPLOAD', user, {
      field: config.field,
      file_name: fileName,
      mime_type: validated.mimeType,
      size_bytes: validated.bytes.length,
    });
    return saved;
  } catch (error) {
    const persisted = findById_(sheetName, prepared.id);
    if (!persisted || String(persisted[config.field] || '') !== fileUrl) file.setTrashed(true);
    throw error;
  }
}

function validateEvidencePayload_(payload, config) {
  if (!payload || !payload.dataBase64) throw new Error('Pilih file yang akan diunggah.');
  let bytes;
  try {
    bytes = Utilities.base64Decode(String(payload.dataBase64));
  } catch (error) {
    throw new Error('File tidak dapat dibaca. Silakan pilih file kembali.');
  }
  if (!bytes.length || bytes.length > MAX_EVIDENCE_FILE_BYTES) throw new Error('Ukuran file harus lebih dari 0 dan maksimal 5 MB.');
  const detectedMime = detectEvidenceMime_(bytes);
  if (!detectedMime || config.allowedMimes.indexOf(detectedMime) < 0) {
    throw new Error('Format file tidak diizinkan. Gunakan JPG, PNG, atau PDF sesuai jenis bukti.');
  }
  if (payload.type && String(payload.type).toLowerCase() !== detectedMime) {
    throw new Error('Isi file tidak sesuai dengan format yang dilaporkan perangkat.');
  }
  return {bytes: bytes, mimeType: detectedMime};
}

function detectEvidenceMime_(bytes) {
  const value = function (index) { return ((Number(bytes[index]) || 0) + 256) % 256; };
  if (bytes.length >= 3 && value(0) === 0xFF && value(1) === 0xD8 && value(2) === 0xFF) return 'image/jpeg';
  if (bytes.length >= 8 && value(0) === 0x89 && value(1) === 0x50 && value(2) === 0x4E && value(3) === 0x47 && value(4) === 0x0D && value(5) === 0x0A && value(6) === 0x1A && value(7) === 0x0A) return 'image/png';
  if (bytes.length >= 5 && value(0) === 0x25 && value(1) === 0x50 && value(2) === 0x44 && value(3) === 0x46 && value(4) === 0x2D) return 'application/pdf';
  return '';
}

function buildEvidenceFileName_(entity, recordId, mimeType, originalName) {
  const extension = {'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf'}[mimeType];
  const originalLeaf = String(originalName || 'bukti').split(/[\\/]/).pop();
  const originalBase = originalLeaf.replace(/\.[^.]+$/, '');
  const baseName = originalBase.replace(/[^a-zA-Z0-9_ -]/g, '_').slice(0, 60) || 'bukti';
  const date = Utilities.formatDate(new Date(), APP.TIME_ZONE, 'yyyyMMdd-HHmmss');
  return date + '-' + String(entity).toUpperCase() + '-' + String(recordId) + '-' + baseName + '.' + extension;
}

function getEvidenceFile_(entity, id, user) {
  const config = EVIDENCE_UPLOADS[entity];
  const sheetName = ENTITY_TO_SHEET[entity];
  if (!config || !sheetName) throw new Error('Modul bukti tidak dikenal.');
  const record = findById_(sheetName, id);
  if (!record) throw new Error('Data tidak ditemukan.');
  const url = String(record[config.field] || '').trim();
  if (!url) throw new Error('Bukti belum tersedia.');
  const fileId = extractDriveFileId_(url);
  if (!fileId) {
    if (/^https:\/\//i.test(url)) return {mode: 'external', url: url};
    throw new Error('Tautan bukti lama tidak valid.');
  }
  let file;
  try {
    file = DriveApp.getFileById(fileId);
  } catch (error) {
    if (/^https:\/\//i.test(url)) return {mode: 'external', url: url};
    throw new Error('File bukti tidak ditemukan.');
  }
  if (!isFileInDocumentsFolder_(file)) return {mode: 'external', url: url};
  const blob = file.getBlob();
  const bytes = blob.getBytes();
  if (bytes.length > MAX_EVIDENCE_FILE_BYTES) throw new Error('File terlalu besar untuk ditampilkan melalui portal.');
  return {
    mode: 'inline',
    name: file.getName(),
    mimeType: blob.getContentType(),
    dataBase64: Utilities.base64Encode(bytes),
  };
}

function extractDriveFileId_(url) {
  const match = String(url || '').match(/(?:\/d\/|[?&]id=)([-\w]{20,})/);
  return match ? match[1] : '';
}

function isFileInDocumentsFolder_(file) {
  const folderId = getRequiredProperty_('DOCUMENTS_DRIVE_FOLDER_ID');
  const parents = file.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === folderId) return true;
  }
  return false;
}

function isExceptionalDisbursement_(record) {
  const threshold = Number(getRequiredProperty_('LARGE_TRANSACTION_THRESHOLD_IDR'));
  return Number(record.amount || 0) >= threshold || String(record.evidence_url || '').trim() === '' || String(record.outside_budget || '').toUpperCase() === 'TRUE';
}

function submitDisbursement_(id, user) {
  const record = findById_('DISBURSEMENTS', id);
  if (!record || record.status !== 'DRAFT') throw new Error('Pengeluaran tidak dapat diajukan.');
  record.status = 'PENDING_CHAIR';
  record.submitted_by = user.email;
  record.submitted_at = nowIso_();
  record.updated_at = nowIso_();
  upsertRecord_('DISBURSEMENTS', record);
  addAudit_('disbursements', id, 'SUBMIT', user, {});
  notifyRole_(ROLES.KETUA, 'Pengeluaran menunggu persetujuan', 'Pengeluaran ' + record.description + ' sebesar Rp' + record.amount + ' menunggu persetujuan.', 'disbursement-submit:' + id);
  return record;
}

function chairDecision_(id, decision, notes, user) {
  const record = findById_('DISBURSEMENTS', id);
  if (!record || record.status !== 'PENDING_CHAIR') throw new Error('Status pengeluaran tidak sesuai.');
  const approved = decision === 'APPROVE';
  record.chair_decision_by = user.email;
  record.chair_decision_at = nowIso_();
  record.status = approved ? (String(record.is_exception) === 'TRUE' ? 'PENDING_SUPERVISOR' : 'COMPLETED') : 'REJECTED';
  if (record.status === 'COMPLETED') record.completed_at = nowIso_();
  record.updated_at = nowIso_();
  upsertRecord_('DISBURSEMENTS', record);
  addApproval_('DISBURSEMENTS', id, 'CHAIR', decision, notes, user);
  addAudit_('disbursements', id, 'CHAIR_' + decision, user, {notes: notes || ''});
  notifyEmail_(record.submitted_by, 'Keputusan pengeluaran', 'Status pengeluaran ' + record.description + ': ' + record.status, 'chair-decision:' + id + ':' + decision);
  if (record.status === 'PENDING_SUPERVISOR') notifyRole_(ROLES.PENGAWAS, 'Pengeluaran memerlukan pemeriksaan', 'Pengeluaran ' + record.description + ' memerlukan pemeriksaan pengawas.', 'supervisor-review:' + id);
  return record;
}

function supervisorDecision_(id, decision, notes, user) {
  const record = findById_('DISBURSEMENTS', id);
  if (!record || record.status !== 'PENDING_SUPERVISOR') throw new Error('Transaksi tidak menunggu pemeriksaan pengawas.');
  record.supervisor_review_by = user.email;
  record.supervisor_review_at = nowIso_();
  record.status = decision === 'VERIFY' ? 'COMPLETED' : 'NEEDS_CLARIFICATION';
  if (record.status === 'COMPLETED') record.completed_at = nowIso_();
  record.updated_at = nowIso_();
  upsertRecord_('DISBURSEMENTS', record);
  addApproval_('DISBURSEMENTS', id, 'SUPERVISOR', decision, notes, user);
  addAudit_('disbursements', id, 'SUPERVISOR_' + decision, user, {notes: notes || ''});
  notifyEmail_(record.submitted_by, 'Hasil pemeriksaan pengawas', 'Status pengeluaran ' + record.description + ': ' + record.status, 'supervisor-decision:' + id + ':' + decision);
  return record;
}

function publicationDecision_(id, decision, notes, user) {
  const record = findById_('PUBLICATIONS', id);
  if (!record || ['DRAFT', 'PENDING_APPROVAL'].indexOf(record.status) < 0) throw new Error('Publikasi tidak dapat diproses.');
  record.status = decision === 'PUBLISH' ? 'PUBLISHED' : 'REJECTED';
  record.published_at = decision === 'PUBLISH' ? nowIso_() : '';
  record.updated_by = user.email;
  record.updated_at = nowIso_();
  upsertRecord_('PUBLICATIONS', record);
  addApproval_('PUBLICATIONS', id, 'CHAIR', decision, notes, user);
  addAudit_('publications', id, decision, user, {notes: notes || ''});
  return record;
}

function notifyRole_(role, subject, body, eventKey) {
  readAll_('USERS').filter(function (user) {
    return user.role === role && String(user.active).toUpperCase() === 'TRUE';
  }).forEach(function (user) { notifyEmail_(user.email, subject, body, eventKey + ':' + user.email); });
}

function notifyEmail_(recipient, subject, body, eventKey) {
  if (!recipient) return;
  const existing = readAll_('NOTIFICATIONS').find(function (item) { return item.event_key === eventKey && item.status === 'SENT'; });
  if (existing) return;
  const notification = {id: newId_('NTF'), event_key: eventKey, recipient: recipient, subject: subject, status: 'PENDING', attempts: 0, last_error: '', sent_at: '', created_at: nowIso_()};
  try {
    MailApp.sendEmail({to: recipient, subject: subject, htmlBody: '<p>' + body + '</p>', name: APP.NAME});
    notification.status = 'SENT';
    notification.attempts = 1;
    notification.sent_at = nowIso_();
  } catch (error) {
    notification.status = 'FAILED';
    notification.attempts = 1;
    notification.last_error = String(error.message || error).slice(0, 300);
  }
  appendRecord_('NOTIFICATIONS', notification);
}
