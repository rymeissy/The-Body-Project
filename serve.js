/* Server untuk prototype The Body Project.
   - Berkas statis (HTML/CSS/JS), tanpa build step.
   - API OTP di /api/auth/* untuk login & registrasi berbasis nomor WhatsApp.

   Jalankan:  node serve.js  [port]

   Variabel lingkungan (opsional):
   FONNTE_TOKEN=xxxx  token Fonnte. Kosongkan untuk mode demo — kode OTP tidak
                      dikirim, tapi dikembalikan di respons agar alurnya bisa
                      dicoba tanpa akun provider.
   TOKEN_SECRET=xxxx  kunci penandatangan token sesi. Wajib di produksi.
   PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD — opsional. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || 4173;

// Rahasia disimpan di .env, yang sudah masuk .gitignore.
//
// process.loadEnvFile() menimpa nilai yang sudah ada di shell, jadi file-nya
// dibaca manual: variabel yang sudah diset di shell tetap menang, .env hanya
// mengisi sisanya. Itu yang membuatnya mudah ditimpa sementara saat dites,
// misalnya $env:FONNTE_TOKEN="" untuk mengaktifkan mode demo.
try {
  const { parseEnv } = require('node:util');
  const isi = parseEnv(fs.readFileSync(path.join(ROOT, '.env'), 'utf8'));
  for (const [key, value] of Object.entries(isi)) {
    if (!(key in process.env)) process.env[key] = value;
  }
} catch { /* .env belum ada — biarkan nilai bawaan */ }

const DB = {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5434),
  database: process.env.PGDATABASE || 'the_body_project',
  user: process.env.PGUSER || 'tbp',
  password: process.env.PGPASSWORD || 'tbp_dev_password'
};

const FONNTE_TOKEN = process.env.FONNTE_TOKEN || '';
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'tbp-dev-secret';

/* Driver PostgreSQL dimuat malas supaya halaman statis tetap bisa dibuka
   walau database tidak menyala. */
let pgPool = null;
let pgError = null;

function db() {
  if (pgPool || pgError) return pgPool;

  try {
    const { Pool } = require('pg');
    pgPool = new Pool({ ...DB, max: 4, connectionTimeoutMillis: 3000 });
    pgPool.on('error', err => { console.error('[db] ' + err.message); });
  } catch (err) {
    pgError = err.message;
    console.error('[db] paket "pg" belum terpasang — jalankan: npm install');
  }
  return pgPool;
}

/* =============================================================================
   Token sesi
   Dipakai sebagai HMAC, bukan tabel, supaya tidak menambah state di database.
   Bentuknya  base64url(userId.expiryMs).signature
   ============================================================================= */

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sign(payload) {
  const body = b64url(payload);
  const mac = crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest();
  return body + '.' + b64url(mac);
}

function verifyToken(token) {
  if (typeof token !== 'string') return null;

  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;

  const body = token.slice(0, dot);
  const given = token.slice(dot + 1);
  const mac = crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest();

  const a = Buffer.from(given);
  const b = Buffer.from(b64url(mac));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const [id, exp] = JSON.parse(Buffer.from(body, 'base64').toString());
    if (!exp || Date.now() > exp) return null;
    return { id: Number(id) };
  } catch { return null; }
}

function issueToken(userId, days) {
  const exp = Date.now() + days * 86400000;
  return sign(Buffer.from(JSON.stringify([userId, exp])));
}

/* =============================================================================
   Nomor telepon
   Disimpan sebagai 62xxxxxxxxx supaya +62 812-3456-7890, 081234567890, dan
   6281234567890 menunjuk ke akun yang sama.
   ============================================================================= */

/* Mengubah apa pun yang diketik menjadi 628xxxxxxxxx, atau null kalau
   bukan nomor ponsel Indonesia yang wajar. Aturan ini sama persis dengan
   CHECK di kolom users.phone dan otp_codes.phone, jadi tidak mungkin nomor
   lolos di satu tempat lalu ditolak di tempat lain — dan pesan error
   database tidak pernah sampai ke user. */
function normalisePhone(raw) {
  if (typeof raw !== 'string') return null;

  let digits = raw.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');

  if (digits.startsWith('+62') || digits.startsWith('62')) {
    digits = '62' + digits.replace(/^\+?62/, '');
  } else if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  } else {
    digits = '62' + digits;
  }

  if (!/^628[0-9]{10}$/.test(digits)) return null;
  return digits;
}

/* 628125551111 -> "+62 812 •••• 1111"
   62 adalah kode negara, tiga angka berikutnya awalan operator. */
function maskPhone(phone) {
  if (phone.length < 8) return phone;
  return '+62 ' + phone.slice(2, 5) + ' •••• ' + phone.slice(-4);
}

/* Terjemahkan kesalahan PostgreSQL menjadi kalimat yang bisa dibaca orang.
   err.message dari pg memuat nama constraint dan detail SQL -- berguna untuk
   log server, tapi kalau tampilannya di layar pengguna seperti "duplicate key
   value violates unique constraint users_email_key", itu hanya menimbulkan
   pertanyaan, bukan jawaban.

   err.asal tetap ditulis ke log supaya tidak ada informasi yang hilang. */
function pesanDatabase(err, konteks) {
  const kode = err && err.code;
  const mentah = (err && err.message ? String(err.message) : '').replace(/^ERROR:\s*/, '');
  console.error('[db] ' + (konteks ? konteks + ': ' : '') + (kode || '-') + ' ' + mentah);

  switch (kode) {
    case 'P0001':
      // RAISE EXCEPTION tanpa errcode dari fungsi PL/pgSQL. Pesannya sudah
      // ditulis untuk dibaca orang -- misalnya "Tunggu 56 detik sebelum
      // meminta kode lagi" -- jadi diteruskan apa adanya.
      return mentah;
    case '23505': {
      // unique_violation
      if (/users_email_key/.test(mentah)) {
        return 'Email ini sudah dipakai akun lain.';
      }
      if (/users_phone_key/.test(mentah)) {
        return 'Nomor WhatsApp ini sudah terdaftar.';
      }
      return 'Data ini sudah dipakai akun lain.';
    }
    case '23503':
      return 'Data yang dimasukkan tidak lagi tersedia.';
    case '23514':
      return 'Format data tidak sesuai.';
    case '22001':
      return 'Data yang dimasukkan terlalu panjang.';
    case '22P02':
      return 'Format data tidak dikenali.';
    default:
      return 'Gagal menyimpan data. Coba lagi sebentar lagi.';
  }
}

/* =============================================================================
   Pengiriman OTP
   ============================================================================= */

async function sendOtp(phone, code, ttlSeconds) {
  if (!FONNTE_TOKEN) {
    return { sent: false, mode: 'demo', code };
  }

  const minutes = Math.max(1, Math.round(ttlSeconds / 60));
  const message =
    'Kode OTP The Body Project: ' + code + '\n' +
    'Berlaku ' + minutes + ' menit. Jangan bagikan ke siapa pun.';

  const res = await fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: { Authorization: FONNTE_TOKEN },
    body: new URLSearchParams({ target: phone, message })
  });

  if (!res.ok) {
    return { sent: false, mode: 'error', detail: 'Fonnte menolak permintaan (' + res.status + ')' };
  }

  const body = await res.json().catch(() => ({}));
  // Sukses datang sebagai boolean true, bukan string "success".
  if (body.status === true || body.status === 'success') {
    return { sent: true, mode: 'whatsapp' };
  }

  // Fonnte melaporkan alasan per nomor di detail.target, dan itu yang paling
  // perlu dilihat user: device belum connect, kuota habis, atau nomor salah.
  const target = body.detail && Array.isArray(body.detail.target) ? body.detail.target[0] : null;
  const reason = (target && target.reason) || body.reason || 'Pengiriman ditolak Fonnte';

  return { sent: false, mode: 'error', detail: reason };
}

/* =============================================================================
   API
   ============================================================================= */

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  }).end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 8192) { reject(new Error('Permintaan terlalu besar')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error('Body harus berupa JSON')); }
    });
    req.on('error', reject);
  });
}

async function route(req, res, url) {
  const pool = db();

  if (!pool) {
    return sendJson(res, 503, { error: 'Koneksi database belum siap', detail: pgError });
  }

  /* ---------- POST /api/auth/otp/request ---------- */
  if (url === '/api/auth/otp/request' && req.method === 'POST') {
    const body = await readBody(req);
    const phone = normalisePhone(body.phone);

    if (!phone) {
      return sendJson(res, 400, { error: 'Nomor WhatsApp tidak valid' });
    }

    let issued;
    try {
      issued = await pool.query('SELECT * FROM fn_request_otp($1)', [phone]);
    } catch (err) {
      // Kesalahan koneksi apa pun (database mati, password salah, port dipakai
      // project lain) akan sampai ke sini juga. Melapiskannya sebagai 429
      // "tunggu N detik" membuat user mengira ini soal throttle, padahal
      // server-nya yang tidak bisa bicara dengan database.
      const offline = err.code === 'ECONNREFUSED' || err.code === '28P01'
        || /timeout|terminated|authentication failed|does not exist/i.test(err.message || '');
      if (offline) {
        console.error('[db] ' + err.message);
        return sendJson(res, 503, {
          error: 'Database belum siap. Jalankan: cd db && docker compose up -d'
        });
      }
      return sendJson(res, 429, { error: err.message.replace(/^ERROR:\s*/, '') });
    }

    const row = issued.rows[0];
    const ttl = Math.round((new Date(row.expires_at) - Date.now()) / 1000);
    const sent = await sendOtp(phone, row.code, ttl);

    if (sent.mode === 'error') {
      return sendJson(res, 502, { error: 'Gagal mengirim OTP', detail: sent.detail });
    }

    return sendJson(res, 200, {
      ok: true,
      phone: maskPhone(phone),
      ttl,
      resendAfter: row.resend_after,
      // Hanya diisi saat mode demo, yaitu FONNTE_TOKEN belum diset.
      demo: sent.mode === 'demo' ? { code: row.code } : undefined
    });
  }

  /* ---------- POST /api/auth/otp/verify ---------- */
  if (url === '/api/auth/otp/verify' && req.method === 'POST') {
    const body = await readBody(req);
    const phone = normalisePhone(body.phone);
    const code = String(body.code || '').trim();

    if (!phone) return sendJson(res, 400, { error: 'Nomor WhatsApp tidak valid' });
    if (!/^\d{6}$/.test(code)) return sendJson(res, 400, { error: 'Kode OTP harus 6 angka' });

    const { rows } = await pool.query(
      'SELECT fn_verify_otp($1, $2) AS result', [phone, code]);

    const result = rows[0].result;
    if (result !== 'ok') {
      const message = {
        expired: 'Kode OTP sudah kadaluarsa. Minta kode baru.',
        locked: 'Terlalu banyak percobaan. Minta kode baru.',
        invalid: 'Kode OTP salah.'
      }[result] || 'Kode OTP salah.';
      return sendJson(res, 400, { error: message, code: result });
    }

    // fn_upsert_user returns the users composite, so pg spreads its columns
    // across the row rather than nesting them. It also creates the account on
    // the spot — there is no sign-up form anywhere.
    const created = await pool.query(
      'SELECT * FROM fn_upsert_user($1)', [phone]);

    const user = created.rows[0];

    return sendJson(res, 200, {
      ok: true,
      token: issueToken(user.id, 30),
      // The app shows the name form once, then never again.
      needsName: !user.name_confirmed,
      user: {
        id: user.id,
        name: user.full_name,
        phone: user.phone,
        email: user.email,
        tier: user.membership_tier,
        // Wajib dikirim, bukan hanya needsName. Full_name pada akun yang baru
        // dibuat masih placeholder ("Pelanggan 7438"), jadi client tidak bisa
        // menebak apakah nama itu sudah asli hanya dari isinya.
        nameConfirmed: user.name_confirmed,
        since: new Date(user.member_since).toLocaleDateString('id-ID',
          { day: 'numeric', month: 'long', year: 'numeric' })
      }
    });
  }

  /* ---------- POST /api/auth/profile ----------
     Dipakai dua kali: sekali setelah OTP untuk menyimpan nama, dan sekali
     lagi dari ikon pensil di tab Profil. Satu endpoint untuk dua-duanya. */
  if (url === '/api/auth/profile' && req.method === 'POST') {
    const session = verifyToken((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
    if (!session) return sendJson(res, 401, { error: 'Sesi tidak valid' });

    const body = await readBody(req);

    // Kirim lastEmail sebagai penanda: tanpa itu, email yang tidak dikirim
    // akan ikut terhapus. NULL berarti "jangan sentuh".
    const untouched = !Object.prototype.hasOwnProperty.call(body, 'email');

    let saved;
    try {
      saved = await pool.query('SELECT * FROM fn_update_profile($1, $2, $3)', [
        session.id,
        String(body.name || '').slice(0, 120),
        untouched ? null : String(body.email || '').slice(0, 180)
      ]);
    } catch (err) {
      return sendJson(res, 400, { error: pesanDatabase(err, 'fn_update_profile') });
    }

    const u = saved.rows[0];
    return sendJson(res, 200, {
      ok: true,
      user: {
        id: u.id, name: u.full_name, phone: u.phone, email: u.email,
        nameConfirmed: u.name_confirmed,
        since: new Date(u.member_since).toLocaleDateString('id-ID',
          { day: 'numeric', month: 'long', year: 'numeric' })
      }
    });
  }

  /* ---------- GET /api/me ---------- */
  if (url === '/api/me' && req.method === 'GET') {
    const auth = req.headers.authorization || '';
    const session = verifyToken(auth.replace(/^Bearer\s+/i, ''));

    if (!session) return sendJson(res, 401, { error: 'Sesi tidak valid' });

    const { rows } = await pool.query(
      'SELECT id, full_name, phone, email, name_confirmed, member_since FROM users WHERE id = $1',
      [session.id]);

    if (!rows.length) return sendJson(res, 401, { error: 'Akun tidak ditemukan' });

    const u = rows[0];
    return sendJson(res, 200, {
      ok: true,
      user: {
        id: u.id, name: u.full_name, phone: u.phone, email: u.email,
        nameConfirmed: u.name_confirmed,
        since: new Date(u.member_since).toLocaleDateString('id-ID',
          { day: 'numeric', month: 'long', year: 'numeric' })
      }
    });
  }

  return sendJson(res, 404, { error: 'Endpoint tidak dikenal' });
}

/* =============================================================================
   Server
   ============================================================================= */

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon'
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);

  if (url.startsWith('/api/')) {
    route(req, res, url).catch(err => {
      // Koneksi ditolak = PostgreSQL belum jalan. Itu kondisi yang perlu
      // diterangkan ke pengguna, bukan bug.
      const offline = err.code === 'ECONNREFUSED' || /timeout|terminated/i.test(err.message || '');
      if (offline) {
        console.error('[api] database tidak terjangkau: ' + err.message);
        if (!res.headersSent) {
          sendJson(res, 503, {
            error: 'Database belum siap. Jalankan: cd db && docker compose up -d'
          });
        }
        return;
      }

      console.error('[api] ' + err.message);
      if (!res.headersSent) sendJson(res, 500, { error: 'Kesalahan server' });
    });
    return;
  }

  let rel = url === '/' ? '/index.html' : url;
  rel = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');

  const file = path.join(ROOT, rel);

  // Cegah path traversal di luar ROOT
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
         .end('404 Not Found: ' + rel);
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    }).end(buf);
  });
}).listen(PORT, () => {
  console.log('Prototype berjalan di http://localhost:' + PORT);
  console.log('  API OTP    : /api/auth/otp/request, /api/auth/otp/verify');
  console.log('  Database   : ' + DB.user + '@' + DB.host + ':' + DB.port + '/' + DB.database);
  console.log('  Pengiriman : ' + (FONNTE_TOKEN ? 'Fonnte (WhatsApp)' : 'mode demo — kode tampil di layar'));
});