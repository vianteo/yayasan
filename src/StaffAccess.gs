function ensureStaffAccessSheets_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const spreadsheet = getSpreadsheet_();
    ['USER_PROGRAM_ACCESS', 'PROGRAM_CHANGE_REQUESTS'].forEach(function (sheetName) {
      let sheet = spreadsheet.getSheetByName(sheetName);
      if (!sheet) sheet = spreadsheet.insertSheet(sheetName);
      const headers = SHEETS[sheetName];
      if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.setFrozenRows(1);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#134e4a').setFontColor('#ffffff');
        sheet.autoResizeColumns(1, headers.length);
        return;
      }
      const existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
      if (JSON.stringify(existing) !== JSON.stringify(headers)) {
        throw new Error('Header sheet ' + sheetName + ' berbeda dari spesifikasi.');
      }
    });
  } finally {
    lock.releaseLock();
  }
}

function todayDate_() {
  return Utilities.formatDate(new Date(), APP.TIME_ZONE, 'yyyy-MM-dd');
}

function isProgramAccessCurrentlyActive_(access, dateValue) {
  const today = String(dateValue || todayDate_());
  if (String(access.active || '').toUpperCase() !== 'TRUE') return false;
  if (access.start_date && String(access.start_date) > today) return false;
  if (access.end_date && String(access.end_date) < today) return false;
  return ['VIEW', 'EDIT'].indexOf(String(access.access_level || '').toUpperCase()) >= 0;
}

function getProgramAccessForUser_(user, requiredLevel) {
  if (!user || user.role !== ROLES.STAF_PROGRAM) return [];
  ensureStaffAccessSheets_();
  const level = String(requiredLevel || 'VIEW').toUpperCase();
  return readAll_('USER_PROGRAM_ACCESS').filter(function (access) {
    if (String(access.user_id) !== String(user.id) || !isProgramAccessCurrentlyActive_(access)) return false;
    return level !== 'EDIT' || String(access.access_level).toUpperCase() === 'EDIT';
  });
}

function getAssignedProgramIds_(user, requiredLevel) {
  return getProgramAccessForUser_(user, requiredLevel).map(function (access) {
    return String(access.program_id);
  }).filter(function (programId, index, values) {
    return programId && values.indexOf(programId) === index;
  });
}

function hasProgramAccess_(user, programId, requiredLevel) {
  return getAssignedProgramIds_(user, requiredLevel).indexOf(String(programId || '')) >= 0;
}

function getEntityProgramId_(entity, record) {
  const field = PROGRAM_SCOPED_ENTITIES[entity];
  return field && record ? String(record[field] || '') : '';
}

function assertStaffCanReadEntity_(entity, record, user) {
  if (!user || user.role !== ROLES.STAF_PROGRAM) return;
  if (STAFF_VISIBLE_ENTITIES.indexOf(entity) < 0) throw new Error('Anda tidak memiliki izin melihat modul ini.');
  const programId = getEntityProgramId_(entity, record);
  if (!programId || !hasProgramAccess_(user, programId, 'VIEW')) {
    throw new Error('Data berada di luar Program yang ditugaskan kepada Anda.');
  }
}

function filterEntityRecordsForUser_(entity, records, user) {
  if (!user || user.role !== ROLES.STAF_PROGRAM) return records;
  if (STAFF_VISIBLE_ENTITIES.indexOf(entity) < 0) throw new Error('Anda tidak memiliki izin melihat modul ini.');
  const assigned = getAssignedProgramIds_(user, 'VIEW');
  return records.filter(function (record) {
    return assigned.indexOf(getEntityProgramId_(entity, record)) >= 0;
  });
}

function assertStaffCanWriteEntity_(entity, input, existing, user) {
  if (!user || user.role !== ROLES.STAF_PROGRAM) return;
  if (STAFF_EDIT_ENTITIES.indexOf(entity) < 0) throw new Error('Staf Program tidak dapat mengubah modul ini secara langsung.');
  const programId = getEntityProgramId_(entity, input) || getEntityProgramId_(entity, existing);
  if (!programId || !hasProgramAccess_(user, programId, 'EDIT')) {
    throw new Error('Anda tidak memiliki akses EDIT pada Program yang dipilih.');
  }
  if (entity === 'publications' && existing && String(existing.status) !== 'DRAFT') {
    throw new Error('Staf Program hanya dapat mengubah publikasi berstatus DRAFT.');
  }
}

function listProgramAccess_(actor) {
  if (actor.role !== ROLES.ADMIN) throw new Error('Anda tidak memiliki izin untuk tindakan ini.');
  ensureStaffAccessSheets_();
  return readAll_('USER_PROGRAM_ACCESS').slice().reverse().slice(0, 500);
}

function saveProgramAccess_(input, actor) {
  if (actor.role !== ROLES.ADMIN) throw new Error('Anda tidak memiliki izin untuk tindakan ini.');
  ensureStaffAccessSheets_();
  const clean = {
    id: String(input && input.id || '').trim(),
    user_id: String(input && input.user_id || '').trim(),
    program_id: String(input && input.program_id || '').trim(),
    access_level: String(input && input.access_level || '').trim().toUpperCase(),
    active: String(input && input.active || '').trim().toUpperCase(),
    start_date: String(input && input.start_date || '').trim(),
    end_date: String(input && input.end_date || '').trim(),
  };
  if (!clean.user_id || !clean.program_id) throw new Error('Pengguna Staf dan Program wajib dipilih.');
  if (['VIEW', 'EDIT'].indexOf(clean.access_level) < 0) throw new Error('Tingkat akses harus VIEW atau EDIT.');
  if (['TRUE', 'FALSE'].indexOf(clean.active) < 0) throw new Error('Status akses tidak valid.');
  if (clean.start_date && !/^\d{4}-\d{2}-\d{2}$/.test(clean.start_date)) throw new Error('Tanggal mulai tidak valid.');
  if (clean.end_date && !/^\d{4}-\d{2}-\d{2}$/.test(clean.end_date)) throw new Error('Tanggal selesai tidak valid.');
  if (clean.start_date && clean.end_date && clean.end_date < clean.start_date) throw new Error('Tanggal selesai tidak boleh sebelum tanggal mulai.');
  const user = findById_('USERS', clean.user_id);
  if (!user || String(user.active).toUpperCase() !== 'TRUE' || String(user.role) !== ROLES.STAF_PROGRAM) {
    throw new Error('Pengguna harus merupakan Staf Program yang aktif.');
  }
  const program = findById_('PROGRAMS', clean.program_id);
  if (!program || !isReferenceActive_(program)) throw new Error('Program tidak ditemukan atau tidak aktif.');
  const records = readAll_('USER_PROGRAM_ACCESS');
  const existing = clean.id ? records.find(function (record) { return String(record.id) === clean.id; }) : null;
  if (clean.id && !existing) throw new Error('Penugasan tidak ditemukan. Muat ulang halaman dan coba lagi.');
  const duplicate = records.find(function (record) {
    return String(record.id) !== clean.id && String(record.user_id) === clean.user_id &&
      String(record.program_id) === clean.program_id && String(record.active).toUpperCase() === 'TRUE' && clean.active === 'TRUE';
  });
  if (duplicate) throw new Error('Staf sudah memiliki penugasan aktif pada Program tersebut.');
  const now = nowIso_();
  const record = Object.assign({}, existing || {}, clean, {
    id: existing ? existing.id : newId_('ACC'),
    created_by: existing ? existing.created_by : actor.email,
    created_at: existing ? existing.created_at : now,
    updated_by: actor.email,
    updated_at: now,
  });
  const saved = upsertRecord_('USER_PROGRAM_ACCESS', record);
  addAudit_('program_access', saved.id, existing ? 'UPDATE' : 'CREATE', actor, {
    user_id: saved.user_id, program_id: saved.program_id, access_level: saved.access_level, active: saved.active,
  });
  return saved;
}

function listProgramChangeRequests_(actor) {
  ensureStaffAccessSheets_();
  const reviewer = [ROLES.SEKRETARIS, ROLES.KETUA, ROLES.ADMIN].indexOf(actor.role) >= 0;
  if (!reviewer && actor.role !== ROLES.STAF_PROGRAM) throw new Error('Anda tidak memiliki izin melihat usulan Program.');
  return readAll_('PROGRAM_CHANGE_REQUESTS').filter(function (request) {
    return reviewer || normalizeEmail_(request.requested_by) === normalizeEmail_(actor.email);
  }).slice().reverse().slice(0, 500);
}

function saveProgramChangeRequest_(input, actor) {
  if (actor.role !== ROLES.STAF_PROGRAM) throw new Error('Hanya Staf Program yang dapat mengajukan perubahan Program.');
  ensureStaffAccessSheets_();
  const programId = String(input && input.program_id || '').trim();
  if (!programId || !hasProgramAccess_(actor, programId, 'EDIT')) throw new Error('Anda tidak memiliki akses EDIT pada Program tersebut.');
  const program = findById_('PROGRAMS', programId);
  if (!program) throw new Error('Program tidak ditemukan.');
  const submitted = input && input.fields || {};
  const fields = {};
  PROGRAM_CHANGE_FIELDS.forEach(function (field) {
    if (Object.prototype.hasOwnProperty.call(submitted, field)) fields[field] = String(submitted[field] == null ? '' : submitted[field]).trim();
  });
  const candidate = Object.assign({}, program, fields);
  validateEntity_('programs', candidate);
  const changed = PROGRAM_CHANGE_FIELDS.filter(function (field) {
    return Object.prototype.hasOwnProperty.call(fields, field) && String(fields[field]) !== String(program[field] || '');
  });
  if (!changed.length) throw new Error('Tidak ada perubahan Program yang diajukan.');
  const pending = readAll_('PROGRAM_CHANGE_REQUESTS').find(function (request) {
    return String(request.program_id) === programId && normalizeEmail_(request.requested_by) === normalizeEmail_(actor.email) && request.status === 'PENDING_REVIEW';
  });
  if (pending) throw new Error('Masih ada usulan Program yang menunggu pemeriksaan.');
  const notes = String(input && input.notes || '').trim().slice(0, 1000);
  const changedFields = {};
  changed.forEach(function (field) {
    changedFields[field] = fields[field];
  });
  const now = nowIso_();
  const request = {
    id: newId_('PCR'), program_id: programId, requested_by: actor.email,
    fields_json: JSON.stringify(changedFields), notes: notes, status: 'PENDING_REVIEW',
    reviewed_by: '', reviewed_at: '', review_notes: '', created_at: now, updated_at: now,
  };
  appendRecord_('PROGRAM_CHANGE_REQUESTS', request);
  addAudit_('program_change_requests', request.id, 'SUBMIT', actor, {program_id: programId, changed_fields: changed});
  notifyRole_(ROLES.SEKRETARIS, 'Usulan perubahan Program', 'Usulan perubahan untuk Program ' + (program.name || program.id) + ' menunggu pemeriksaan.', 'program-change-submit:' + request.id);
  return request;
}

function decideProgramChangeRequest_(id, decision, reviewNotes, actor) {
  if ([ROLES.SEKRETARIS, ROLES.KETUA, ROLES.ADMIN].indexOf(actor.role) < 0) throw new Error('Anda tidak memiliki izin memeriksa usulan Program.');
  if (['APPROVE', 'REJECT'].indexOf(decision) < 0) throw new Error('Keputusan usulan tidak valid.');
  ensureStaffAccessSheets_();
  const request = findById_('PROGRAM_CHANGE_REQUESTS', id);
  if (!request || request.status !== 'PENDING_REVIEW') throw new Error('Usulan tidak lagi menunggu pemeriksaan.');
  const program = findById_('PROGRAMS', request.program_id);
  if (!program) throw new Error('Program tujuan tidak ditemukan.');
  if (decision === 'APPROVE') {
    let fields;
    try {
      fields = JSON.parse(request.fields_json || '{}');
    } catch (error) {
      throw new Error('Isi usulan tidak dapat dibaca.');
    }
    const safeFields = {};
    PROGRAM_CHANGE_FIELDS.forEach(function (field) {
      if (Object.prototype.hasOwnProperty.call(fields, field)) safeFields[field] = fields[field];
    });
    saveEntity_('programs', Object.assign({id: program.id}, safeFields), actor);
  }
  request.status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  request.reviewed_by = actor.email;
  request.reviewed_at = nowIso_();
  request.review_notes = String(reviewNotes || '').trim().slice(0, 1000);
  request.updated_at = nowIso_();
  const saved = upsertRecord_('PROGRAM_CHANGE_REQUESTS', request);
  addApproval_('PROGRAMS', program.id, 'PROGRAM_CHANGE', decision, request.review_notes, actor);
  addAudit_('program_change_requests', request.id, decision, actor, {program_id: program.id});
  const requester = readAll_('USERS').find(function (user) { return normalizeEmail_(user.email) === normalizeEmail_(request.requested_by); });
  if (requester) notifyEmail_(requester.email, 'Keputusan usulan Program', 'Usulan perubahan Program ' + (program.name || program.id) + ': ' + request.status, 'program-change-decision:' + request.id + ':' + decision);
  return saved;
}
