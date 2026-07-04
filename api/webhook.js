/**
 * api/webhook.js
 * ------------------------------------------------------------
 * Versi Node.js (Vercel Serverless Function) dari webhook.php.
 * Jembatan antara EA MetaTrader 5 dan halaman web Farid Gold Killer.
 *
 * - EA MT5 kirim POST ke sini setiap ada entry/close/pending/modify + stats akun
 * - Halaman web (fetchSignals) kirim GET ke sini untuk ambil data terbaru
 * - Data disimpan di JSONBin
 *
 * DEPLOY:
 *   1. Taruh file ini di:  /api/webhook.js  (root project Vercel)
 *   2. Di Vercel dashboard -> Project -> Settings -> Environment Variables, tambahkan:
 *        JSONBIN_ID    = 69f6caf536566621a81bc334
 *        JSONBIN_KEY   = (X-Master-Key JSONBin kamu)
 *        EA_SECRET     = (kata sandi rahasia bebas, buat sendiri)
 *   3. Deploy (vercel --prod atau lewat Vercel:deploy_to_vercel).
 *   4. URL akhir otomatis jadi: https://nama-project-kamu.vercel.app/api/webhook
 * ------------------------------------------------------------
 */

const MAX_HISTORY = 50;

const JSONBIN_ID  = process.env.JSONBIN_ID;
const JSONBIN_KEY = process.env.JSONBIN_KEY;
const EA_SECRET   = process.env.EA_SECRET;
const BIN_URL     = `https://api.jsonbin.io/v3/b/${JSONBIN_ID}`;

async function jsonbinGet() {
  const r = await fetch(`${BIN_URL}/latest`, {
    headers: { 'X-Master-Key': JSONBIN_KEY },
  });
  const data = await r.json();
  return data.record || { history: [], stats: {} };
}

async function jsonbinPut(record) {
  await fetch(BIN_URL, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': JSONBIN_KEY,
    },
    body: JSON.stringify(record),
  });
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-EA-Secret');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ====== GET: halaman web minta data terbaru ======
  if (req.method === 'GET') {
    const record = await jsonbinGet();
    return res.status(200).json(record);
  }

  // ====== POST: EA MT5 kirim event baru ======
  if (req.method === 'POST') {
    const secret = req.headers['x-ea-secret'];
    if (secret !== EA_SECRET) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const payload = req.body;
    if (!payload) return res.status(400).json({ error: 'invalid json' });

    const record = await jsonbinGet();
    if (!Array.isArray(record.history)) record.history = [];

    if (payload.type === 'stats') {
      record.stats = {
        balance: payload.balance ?? 0,
        equity: payload.equity ?? 0,
        unrealized_pnl: payload.unrealized_pnl ?? 0,
        timestamp: payload.timestamp ?? new Date().toISOString(),
      };
    } else {
      const entry = {
        symbol: payload.symbol ?? '',
        action: payload.action ?? '',      // BUY / SELL / CLOSE / PENDING
        status: payload.status ?? '',      // PLACED / EXECUTED / MODIFIED / CLOSED
        mode: payload.mode ?? 'Normal',
        price: payload.price ?? 0,
        sl: payload.sl ?? 0,
        tp: payload.tp ?? 0,
        lots: payload.lots ?? 0,
        pips: payload.pips ?? 0,
        profit: payload.profit ?? null,
        comment: payload.comment ?? '',
        timestamp: payload.timestamp ?? new Date().toISOString(),
      };
      record.history.unshift(entry);
      record.history = record.history.slice(0, MAX_HISTORY);
    }

    await jsonbinPut(record);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
