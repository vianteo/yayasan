function getPublicData() {
  const programs = readAll_('PROGRAMS').filter(function (item) { return ['ACTIVE', 'SELESAI'].indexOf(item.status) >= 0; });
  const publications = readAll_('PUBLICATIONS').filter(function (item) { return item.status === 'PUBLISHED'; });
  const donations = readAll_('DONATIONS').filter(function (item) { return ['TERVERIFIKASI', 'DIALOKASIKAN'].indexOf(item.status) >= 0; });
  const disbursements = readAll_('DISBURSEMENTS').filter(function (item) { return item.status === 'COMPLETED'; });
  return {
    organization: {name: APP.NAME, affiliationLabel: APP.AFFILIATION_LABEL},
    programs: programs.map(publicProgram_),
    publications: publications.map(publicPublication_),
    summary: {
      activePrograms: programs.filter(function (item) { return item.status === 'ACTIVE'; }).length,
      beneficiaries: readAll_('BENEFICIARIES').filter(function (item) { return item.status !== 'ARCHIVED'; }).length,
      donations: donations.reduce(function (sum, item) { return sum + Number(item.amount || 0); }, 0),
      disbursements: disbursements.reduce(function (sum, item) { return sum + Number(item.amount || 0); }, 0),
    },
    contact: getPublicSettings_(),
  };
}

function getInternalBootstrap(token) {
  const user = requireUser_(token);
  const isStaff = user.role === ROLES.STAF_PROGRAM;
  const programs = filterEntityRecordsForUser_('programs', readAll_('PROGRAMS'), user);
  const participants = filterEntityRecordsForUser_('participants', readAll_('PARTICIPANTS'), user);
  const beneficiaries = filterEntityRecordsForUser_('beneficiaries', readAll_('BENEFICIARIES'), user);
  const disbursements = isStaff ? [] : readAll_('DISBURSEMENTS');
  return {
    user: safeUser_(user),
    editableProgramIds: isStaff ? getAssignedProgramIds_(user, 'EDIT') : [],
    counts: {
      programs: programs.length,
      participants: participants.length,
      beneficiaries: beneficiaries.length,
      donors: isStaff ? 0 : readAll_('DONORS').length,
      pendingChair: disbursements.filter(function (item) { return item.status === 'PENDING_CHAIR'; }).length,
      pendingSupervisor: disbursements.filter(function (item) { return item.status === 'PENDING_SUPERVISOR'; }).length,
    },
    permissions: Object.keys(EDIT_ROLES).filter(function (entity) {
      return EDIT_ROLES[entity].indexOf(user.role) >= 0 && (!isStaff || STAFF_EDIT_ENTITIES.indexOf(entity) >= 0);
    }),
    health: healthCheck(),
  };
}

function listEntity(token, entity) {
  const user = requireUser_(token);
  const sheetName = ENTITY_TO_SHEET[entity];
  if (!sheetName) throw new Error('Modul tidak dikenal.');
  return filterEntityRecordsForUser_(entity, readAll_(sheetName), user).slice().reverse().slice(0, 500);
}

function saveEntity(token, entity, input) {
  const user = requireUser_(token, EDIT_ROLES[entity] || []);
  const safeInput = Object.assign({}, input || {});
  const evidenceConfig = EVIDENCE_UPLOADS[entity];
  if (evidenceConfig) delete safeInput[evidenceConfig.field];
  return saveEntity_(entity, safeInput, user);
}

function saveEntityWithEvidence(token, entity, input, payload) {
  const user = requireUser_(token, EDIT_ROLES[entity] || []);
  return saveEntityWithEvidence_(entity, input, payload, user);
}

function getEvidenceFile(token, entity, id) {
  return getEvidenceFile_(entity, id, requireUser_(token));
}

function archiveEntity(token, entity, id) {
  const user = requireUser_(token, EDIT_ROLES[entity] || []);
  if (user.role === ROLES.STAF_PROGRAM) throw new Error('Staf Program tidak dapat mengarsipkan data.');
  const sheetName = ENTITY_TO_SHEET[entity];
  const record = findById_(sheetName, id);
  if (!record) throw new Error('Data tidak ditemukan.');
  record.status = 'ARCHIVED';
  record.updated_by = user.email;
  record.updated_at = nowIso_();
  upsertRecord_(sheetName, record);
  addAudit_(entity, id, 'ARCHIVE', user, {});
  return record;
}

function submitDisbursement(token, id) {
  return submitDisbursement_(id, requireUser_(token, [ROLES.BENDAHARA, ROLES.ADMIN]));
}

function decideDisbursement(token, id, decision, notes) {
  if (['APPROVE', 'REJECT'].indexOf(decision) < 0) throw new Error('Keputusan tidak valid.');
  return chairDecision_(id, decision, notes, requireUser_(token, [ROLES.KETUA, ROLES.ADMIN]));
}

function reviewDisbursement(token, id, decision, notes) {
  if (['VERIFY', 'CLARIFY'].indexOf(decision) < 0) throw new Error('Keputusan tidak valid.');
  return supervisorDecision_(id, decision, notes, requireUser_(token, [ROLES.PENGAWAS, ROLES.ADMIN]));
}

function decidePublication(token, id, decision, notes) {
  if (['PUBLISH', 'REJECT'].indexOf(decision) < 0) throw new Error('Keputusan tidak valid.');
  return publicationDecision_(id, decision, notes, requireUser_(token, [ROLES.KETUA, ROLES.ADMIN]));
}

function getAuditLog(token) {
  requireUser_(token, [ROLES.PEMBINA, ROLES.PENGAWAS, ROLES.KETUA, ROLES.ADMIN]);
  return readAll_('AUDIT_LOG').slice().reverse().slice(0, 500);
}

function listUsers(token) {
  return listUsers_(requireUser_(token, [ROLES.ADMIN]));
}

function saveUser(token, input) {
  return saveUser_(input, requireUser_(token, [ROLES.ADMIN]));
}

function listProgramAccess(token) {
  return listProgramAccess_(requireUser_(token, [ROLES.ADMIN]));
}

function saveProgramAccess(token, input) {
  return saveProgramAccess_(input, requireUser_(token, [ROLES.ADMIN]));
}

function listProgramChangeRequests(token) {
  return listProgramChangeRequests_(requireUser_(token));
}

function saveProgramChangeRequest(token, input) {
  return saveProgramChangeRequest_(input, requireUser_(token, [ROLES.STAF_PROGRAM]));
}

function decideProgramChangeRequest(token, id, decision, reviewNotes) {
  return decideProgramChangeRequest_(id, decision, reviewNotes, requireUser_(token, [ROLES.SEKRETARIS, ROLES.KETUA, ROLES.ADMIN]));
}

function getReferenceOptions(token) {
  const user = requireUser_(token);
  const isStaff = user.role === ROLES.STAF_PROGRAM;
  const editableProgramIds = isStaff ? getAssignedProgramIds_(user, 'EDIT') : [];
  const programs = readAll_('PROGRAMS').filter(function (program) {
    return !isStaff || editableProgramIds.indexOf(String(program.id)) >= 0;
  });
  const donors = isStaff ? [] : readAll_('DONORS');
  const donations = isStaff ? [] : readAll_('DONATIONS');
  const publications = isStaff ? filterEntityRecordsForUser_('publications', readAll_('PUBLICATIONS'), user) : readAll_('PUBLICATIONS');
  const donorNames = donors.reduce(function (output, donor) {
    output[donor.id] = donor.name || donor.id;
    return output;
  }, {});
  return {
    programs: buildReferenceOptions_(programs, function (program) {
      return (program.name || 'Program tanpa nama') + ' — ' + program.id;
    }),
    donors: buildReferenceOptions_(donors, function (donor) {
      return (donor.name || 'Donatur tanpa nama') + (donor.email ? ' (' + donor.email + ')' : '') + ' — ' + donor.id;
    }),
    donations: buildReferenceOptions_(donations, function (donation) {
      return (donation.receipt_number || donation.id) + ' — ' + (donorNames[donation.donor_id] || 'Donatur tidak tersedia') + (donation.received_date ? ' — ' + donation.received_date : '');
    }),
    publications: buildReferenceOptions_(publications, function (publication) {
      return (publication.title || 'Publikasi tanpa judul') + ' — ' + publication.id;
    }),
  };
}

function buildReferenceOptions_(records, labelBuilder) {
  return records.filter(function (record) {
    return record.id && isReferenceActive_(record);
  }).map(function (record) {
    return {value: String(record.id), label: String(labelBuilder(record))};
  }).sort(function (a, b) {
    return a.label.localeCompare(b.label, 'id');
  });
}

function publicProgram_(record) {
  return {id: record.id, name: record.name, category: record.category, description: record.description, target: record.target, startDate: record.start_date, endDate: record.end_date, affiliated: record.affiliated === 'TRUE', affiliationLabel: record.affiliated === 'TRUE' ? APP.AFFILIATION_LABEL : ''};
}

function publicPublication_(record) {
  return {id: record.id, type: record.type, title: record.title, summary: record.summary, content: record.content, coverUrl: record.cover_url, publishedAt: record.published_at, affiliated: record.affiliated === 'TRUE', affiliationLabel: record.affiliated === 'TRUE' ? APP.AFFILIATION_LABEL : ''};
}

function getPublicSettings_() {
  const allowed = ['OFFICIAL_BANK_NAME', 'OFFICIAL_BANK_ACCOUNT_NAME', 'OFFICIAL_BANK_ACCOUNT_NUMBER', 'PUBLIC_EMAIL', 'PUBLIC_PHONE', 'PUBLIC_ADDRESS'];
  const output = {
    OFFICIAL_BANK_NAME: OFFICIAL_BANK.NAME,
    OFFICIAL_BANK_ACCOUNT_NAME: OFFICIAL_BANK.ACCOUNT_NAME,
    OFFICIAL_BANK_ACCOUNT_NUMBER: OFFICIAL_BANK.ACCOUNT_NUMBER,
  };
  return readAll_('SETTINGS').filter(function (item) {
    return allowed.indexOf(item.key) >= 0;
  }).reduce(function (settings, item) {
    const value = String(item.value || '').trim();
    if (value) settings[item.key] = value;
    return settings;
  }, output);
}
