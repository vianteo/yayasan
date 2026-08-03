const APP = Object.freeze({
  NAME: 'Yayasan Bina Tali Kasih',
  TIME_ZONE: 'Asia/Jakarta',
  TOKEN_TTL_SECONDS: 8 * 60 * 60,
  OTP_TTL_SECONDS: 10 * 60,
  OTP_COOLDOWN_SECONDS: 60,
  MAX_LOGIN_ATTEMPTS: 5,
  AFFILIATION_LABEL: 'Berkolaborasi dengan GPdI Pniel Deltamas',
});

const ROLES = Object.freeze({
  PEMBINA: 'PEMBINA',
  PENGAWAS: 'PENGAWAS',
  KETUA: 'KETUA',
  WAKIL_KETUA: 'WAKIL_KETUA',
  SEKRETARIS: 'SEKRETARIS',
  BENDAHARA: 'BENDAHARA',
  ADMIN: 'ADMIN',
});

const SHEETS = Object.freeze({
  USERS: ['id', 'email', 'name', 'role', 'active', 'created_at', 'updated_at'],
  PROGRAMS: ['id', 'name', 'category', 'description', 'target', 'start_date', 'end_date', 'budget', 'pic', 'affiliated', 'status', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  ACTIVITIES: ['id', 'program_id', 'title', 'activity_date', 'location', 'description', 'beneficiary_count', 'status', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  PARTICIPANTS: ['id', 'program_id', 'name', 'identity_key', 'birth_date', 'phone', 'address', 'status', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  BENEFICIARIES: ['id', 'program_id', 'name', 'identity_key', 'category', 'phone', 'address', 'verification_notes', 'status', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  DONORS: ['id', 'name', 'type', 'email', 'phone', 'anonymous_public', 'active', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  DONATIONS: ['id', 'receipt_number', 'donor_id', 'program_id', 'donation_type', 'amount', 'received_date', 'payment_method', 'evidence_url', 'notes', 'status', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  DONATION_ITEMS: ['id', 'donation_id', 'item_name', 'quantity', 'unit', 'condition', 'estimated_value', 'status', 'distribution_evidence_url', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  DISBURSEMENTS: ['id', 'program_id', 'transaction_date', 'description', 'amount', 'recipient', 'evidence_url', 'is_exception', 'status', 'submitted_by', 'submitted_at', 'chair_decision_by', 'chair_decision_at', 'supervisor_review_by', 'supervisor_review_at', 'completed_at', 'created_at', 'updated_at'],
  APPROVALS: ['id', 'entity', 'entity_id', 'stage', 'decision', 'notes', 'actor_email', 'actor_role', 'created_at'],
  PUBLICATIONS: ['id', 'type', 'title', 'summary', 'content', 'cover_url', 'program_id', 'affiliated', 'status', 'published_at', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  MEDIA: ['id', 'publication_id', 'file_url', 'caption', 'consent_confirmed', 'status', 'created_by', 'created_at'],
  AUDIT_LOG: ['id', 'entity', 'entity_id', 'action', 'actor_email', 'actor_role', 'detail_json', 'created_at'],
  SETTINGS: ['key', 'value', 'description', 'updated_by', 'updated_at'],
  BACKUP_LOG: ['id', 'file_id', 'file_name', 'status', 'notes', 'created_at'],
  NOTIFICATIONS: ['id', 'event_key', 'recipient', 'subject', 'status', 'attempts', 'last_error', 'sent_at', 'created_at'],
});

const ENTITY_TO_SHEET = Object.freeze({
  programs: 'PROGRAMS',
  activities: 'ACTIVITIES',
  participants: 'PARTICIPANTS',
  beneficiaries: 'BENEFICIARIES',
  donors: 'DONORS',
  donations: 'DONATIONS',
  donationItems: 'DONATION_ITEMS',
  disbursements: 'DISBURSEMENTS',
  publications: 'PUBLICATIONS',
  media: 'MEDIA',
});

const EDIT_ROLES = Object.freeze({
  programs: [ROLES.SEKRETARIS, ROLES.KETUA, ROLES.ADMIN],
  activities: [ROLES.SEKRETARIS, ROLES.KETUA, ROLES.ADMIN],
  participants: [ROLES.SEKRETARIS, ROLES.ADMIN],
  beneficiaries: [ROLES.SEKRETARIS, ROLES.ADMIN],
  donors: [ROLES.BENDAHARA, ROLES.ADMIN],
  donations: [ROLES.BENDAHARA, ROLES.ADMIN],
  donationItems: [ROLES.BENDAHARA, ROLES.ADMIN],
  disbursements: [ROLES.BENDAHARA, ROLES.ADMIN],
  publications: [ROLES.SEKRETARIS, ROLES.ADMIN],
  media: [ROLES.SEKRETARIS, ROLES.ADMIN],
});

function getRequiredProperty_(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) throw new Error('Konfigurasi aplikasi belum lengkap: ' + name);
  return value;
}

function nowIso_() {
  return Utilities.formatDate(new Date(), APP.TIME_ZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function newId_(prefix) {
  return String(prefix || 'ID') + '-' + Utilities.getUuid();
}
