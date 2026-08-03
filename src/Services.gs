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
  validateEntity_(entity, input || {});
  const now = nowIso_();
  const clean = sanitizeRecord_(input || {});
  const existing = clean.id ? findById_(sheetName, clean.id) : null;
  const record = Object.assign({}, existing || {}, clean, {
    id: clean.id || newId_(sheetName.slice(0, 3)),
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
