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
  const disbursements = readAll_('DISBURSEMENTS');
  return {
    user: safeUser_(user),
    counts: {
      programs: readAll_('PROGRAMS').length,
      participants: readAll_('PARTICIPANTS').length,
      beneficiaries: readAll_('BENEFICIARIES').length,
      donors: readAll_('DONORS').length,
      pendingChair: disbursements.filter(function (item) { return item.status === 'PENDING_CHAIR'; }).length,
      pendingSupervisor: disbursements.filter(function (item) { return item.status === 'PENDING_SUPERVISOR'; }).length,
    },
    permissions: Object.keys(EDIT_ROLES).filter(function (entity) { return EDIT_ROLES[entity].indexOf(user.role) >= 0; }),
    health: healthCheck(),
  };
}

function listEntity(token, entity) {
  requireUser_(token);
  const sheetName = ENTITY_TO_SHEET[entity];
  if (!sheetName) throw new Error('Modul tidak dikenal.');
  return readAll_(sheetName).slice().reverse().slice(0, 500);
}

function saveEntity(token, entity, input) {
  const user = requireUser_(token, EDIT_ROLES[entity] || []);
  return saveEntity_(entity, input, user);
}

function archiveEntity(token, entity, id) {
  const user = requireUser_(token, EDIT_ROLES[entity] || []);
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

function publicProgram_(record) {
  return {id: record.id, name: record.name, category: record.category, description: record.description, target: record.target, startDate: record.start_date, endDate: record.end_date, affiliated: record.affiliated === 'TRUE', affiliationLabel: record.affiliated === 'TRUE' ? APP.AFFILIATION_LABEL : ''};
}

function publicPublication_(record) {
  return {id: record.id, type: record.type, title: record.title, summary: record.summary, content: record.content, coverUrl: record.cover_url, publishedAt: record.published_at, affiliated: record.affiliated === 'TRUE', affiliationLabel: record.affiliated === 'TRUE' ? APP.AFFILIATION_LABEL : ''};
}

function getPublicSettings_() {
  const allowed = ['OFFICIAL_BANK_NAME', 'OFFICIAL_BANK_ACCOUNT_NAME', 'OFFICIAL_BANK_ACCOUNT_NUMBER', 'PUBLIC_EMAIL', 'PUBLIC_PHONE', 'PUBLIC_ADDRESS'];
  return readAll_('SETTINGS').filter(function (item) { return allowed.indexOf(item.key) >= 0; }).reduce(function (output, item) { output[item.key] = item.value; return output; }, {});
}
