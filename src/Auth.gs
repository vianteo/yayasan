function normalizeEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function getActiveUserRecord_(email) {
  const normalized = normalizeEmail_(email);
  return readAll_('USERS').find(function (user) {
    return normalizeEmail_(user.email) === normalized && String(user.active).toUpperCase() === 'TRUE';
  }) || null;
}

function requestLoginCode(email) {
  const normalized = normalizeEmail_(email);
  if (!/^\S+@\S+\.\S+$/.test(normalized)) return genericLoginResponse_();
  const cache = CacheService.getScriptCache();
  const cooldownKey = 'otp-cooldown:' + hashText_(normalized);
  if (cache.get(cooldownKey)) return genericLoginResponse_();
  cache.put(cooldownKey, '1', APP.OTP_COOLDOWN_SECONDS);

  const user = getActiveUserRecord_(normalized);
  if (!user) return genericLoginResponse_();

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const nonce = Utilities.getUuid();
  const payload = JSON.stringify({hash: hashText_(normalized + ':' + code + ':' + nonce), nonce: nonce, attempts: 0});
  cache.put('otp:' + hashText_(normalized), payload, APP.OTP_TTL_SECONDS);
  MailApp.sendEmail({
    to: normalized,
    subject: 'Kode login ' + APP.NAME,
    htmlBody: '<p>Kode login Anda:</p><p style="font-size:28px;font-weight:bold;letter-spacing:5px">' + code + '</p><p>Kode berlaku 10 menit. Abaikan email ini jika Anda tidak meminta login.</p>',
    name: APP.NAME,
  });
  return genericLoginResponse_();
}

function genericLoginResponse_() {
  return {ok: true, message: 'Jika email terdaftar, kode login telah dikirim.'};
}

function verifyLoginCode(email, code) {
  const normalized = normalizeEmail_(email);
  const cache = CacheService.getScriptCache();
  const cacheKey = 'otp:' + hashText_(normalized);
  const raw = cache.get(cacheKey);
  if (!raw) throw new Error('Kode tidak valid atau sudah kedaluwarsa.');
  const state = JSON.parse(raw);
  state.attempts = Number(state.attempts || 0) + 1;
  if (state.attempts > APP.MAX_LOGIN_ATTEMPTS) {
    cache.remove(cacheKey);
    throw new Error('Terlalu banyak percobaan. Silakan minta kode baru.');
  }
  const expected = hashText_(normalized + ':' + String(code || '').trim() + ':' + state.nonce);
  if (expected !== state.hash) {
    cache.put(cacheKey, JSON.stringify(state), APP.OTP_TTL_SECONDS);
    throw new Error('Kode tidak valid atau sudah kedaluwarsa.');
  }
  const user = getActiveUserRecord_(normalized);
  if (!user) throw new Error('Akun tidak memiliki akses.');
  cache.remove(cacheKey);
  addAudit_('AUTH', user.id, 'LOGIN', user, {});
  return {token: issueToken_(user), user: safeUser_(user)};
}

function issueToken_(user) {
  const payload = {
    sub: normalizeEmail_(user.email),
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + APP.TOKEN_TTL_SECONDS,
    nonce: Utilities.getUuid(),
  };
  const encoded = Utilities.base64EncodeWebSafe(JSON.stringify(payload), Utilities.Charset.UTF_8).replace(/=+$/, '');
  return encoded + '.' + sign_(encoded);
}

function requireUser_(token, allowedRoles) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2 || sign_(parts[0]) !== parts[1]) throw new Error('Sesi tidak valid. Silakan login kembali.');
  const payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Sesi telah berakhir. Silakan login kembali.');
  const user = getActiveUserRecord_(payload.sub);
  if (!user || user.role !== payload.role) throw new Error('Akses pengguna telah berubah. Silakan login kembali.');
  if (allowedRoles && allowedRoles.indexOf(user.role) < 0) throw new Error('Anda tidak memiliki izin untuk tindakan ini.');
  return user;
}

function sign_(text) {
  const bytes = Utilities.computeHmacSha256Signature(text, getRequiredProperty_('SESSION_SIGNING_KEY'));
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

function hashText_(text) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8);
  return digest.map(function (byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
}

function safeUser_(user) {
  return {id: user.id, email: user.email, name: user.name, role: user.role};
}

function listUsers_(actor) {
  if (actor.role !== ROLES.ADMIN) throw new Error('Anda tidak memiliki izin untuk tindakan ini.');
  return readAll_('USERS').map(safeManagedUser_).sort(function (a, b) {
    return String(a.name || a.email).localeCompare(String(b.name || b.email), 'id');
  });
}

function saveUser_(input, actor) {
  if (actor.role !== ROLES.ADMIN) throw new Error('Anda tidak memiliki izin untuk tindakan ini.');
  const clean = validateManagedUserInput_(input || {});
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let saved;
  let action;
  try {
    const sheet = getSheet_('USERS');
    const values = sheet.getDataRange().getValues();
    const headers = values[0].map(String);
    const records = values.slice(1).filter(function (row) {
      return row.some(function (value) { return value !== ''; });
    }).map(function (row) {
      return headers.reduce(function (record, header, index) {
        record[header] = row[index];
        return record;
      }, {});
    });
    const existing = clean.id ? records.find(function (record) {
      return String(record.id) === clean.id;
    }) : null;
    if (clean.id && !existing) throw new Error('Pengguna tidak ditemukan. Muat ulang halaman dan coba lagi.');
    const duplicate = records.find(function (record) {
      return normalizeEmail_(record.email) === clean.email && String(record.id) !== clean.id;
    });
    if (duplicate) throw new Error('Email sudah terdaftar pada pengguna lain.');

    const editingSelf = existing && normalizeEmail_(existing.email) === normalizeEmail_(actor.email);
    if (editingSelf && (clean.role !== ROLES.ADMIN || clean.active !== 'TRUE')) {
      throw new Error('Super Admin tidak dapat menurunkan peran atau menonaktifkan akunnya sendiri.');
    }
    if (existing && String(existing.role) === ROLES.ADMIN && String(existing.active).toUpperCase() === 'TRUE' &&
        (clean.role !== ROLES.ADMIN || clean.active !== 'TRUE')) {
      const otherActiveAdmins = records.filter(function (record) {
        return String(record.id) !== clean.id && String(record.role) === ROLES.ADMIN && String(record.active).toUpperCase() === 'TRUE';
      });
      if (!otherActiveAdmins.length) throw new Error('Minimal satu Super Admin harus tetap aktif.');
    }

    const now = nowIso_();
    saved = {
      id: existing ? String(existing.id) : newId_('USR'),
      email: clean.email,
      name: clean.name,
      role: clean.role,
      active: clean.active,
      created_at: existing ? existing.created_at : now,
      updated_at: now,
    };
    const row = headers.map(function (header) {
      return Object.prototype.hasOwnProperty.call(saved, header) ? saved[header] : '';
    });
    if (existing) {
      const idIndex = headers.indexOf('id');
      const rowIndex = values.findIndex(function (value, index) {
        return index > 0 && String(value[idIndex]) === clean.id;
      });
      sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([row]);
      action = 'UPDATE';
    } else {
      sheet.appendRow(row);
      action = 'CREATE';
    }
  } finally {
    lock.releaseLock();
  }
  addAudit_('users', saved.id, action, actor, {email: saved.email, role: saved.role, active: saved.active});
  return safeManagedUser_(saved);
}

function validateManagedUserInput_(input) {
  const id = String(input.id || '').trim();
  const email = normalizeEmail_(input.email);
  const name = String(input.name || '').trim();
  const role = String(input.role || '').trim().toUpperCase();
  const active = String(input.active || '').trim().toUpperCase();
  if (!name) throw new Error('Nama pengguna wajib diisi.');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Format email tidak valid.');
  if (/^[=+\-@]/.test(name) || /^[=+\-@]/.test(email)) throw new Error('Nama atau email mengandung karakter awal yang tidak diizinkan.');
  if (Object.keys(ROLES).map(function (key) { return ROLES[key]; }).indexOf(role) < 0) throw new Error('Peran pengguna tidak valid.');
  if (['TRUE', 'FALSE'].indexOf(active) < 0) throw new Error('Status pengguna tidak valid.');
  return {id: id, email: email, name: name, role: role, active: active};
}

function safeManagedUser_(user) {
  return {
    id: String(user.id || ''),
    email: normalizeEmail_(user.email),
    name: String(user.name || ''),
    role: String(user.role || ''),
    active: String(user.active || '').toUpperCase(),
    created_at: String(user.created_at || ''),
    updated_at: String(user.updated_at || ''),
  };
}
