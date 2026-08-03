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
