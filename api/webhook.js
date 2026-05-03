// File: api/webhook.js

export default async function handler(req, res) {
  // 1. Setup CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Ambil Config
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'farid_1124';
  const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID || '69f6caf536566621a81bc334';
  const JSONBIN_MASTER_KEY = process.env.JSONBIN_MASTER_KEY || '$2a$10$tcKHEWwuz2sqRoMCKJfga.1xxTFW0RxpXUPnP.NI4YbivtlK1xxau';
  const MAX_HISTORY = 30;

  // --- METHOD GET: AMBIL HISTORY & STATS DENGAN CACHE ---
  if (req.method === 'GET') {
    // MAGIC BULLET: Cache Vercel CDN selama 60 detik. Mencegah limit JSONBin!
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    
    try {
      const getRes = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
        method: 'GET',
        headers: { 'X-Master-Key': JSONBIN_MASTER_KEY }
      });
      if (getRes.ok) {
        const parsed = await getRes.json();
        return res.status(200).json(parsed.record || { history: [], stats: {} });
      }
      return res.status(500).json({ error: 'Failed to fetch from JSONBin' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // --- METHOD DELETE: CLEAR HISTORY ---
  if (req.method === 'DELETE') {
    if (req.headers['x-secret'] !== WEBHOOK_SECRET) return res.status(403).json({ error: 'Forbidden' });
    try {
      // Hanya mengosongkan history, biarkan stats tetap ada
      const getRes = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, { headers: { 'X-Master-Key': JSONBIN_MASTER_KEY }});
      let currentData = { history: [], stats: {} };
      if (getRes.ok) currentData = (await getRes.json()).record || currentData;
      currentData.history = []; // Clear history

      const putRes = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_MASTER_KEY },
        body: JSON.stringify(currentData)
      });
      if (putRes.ok) return res.status(200).json({ status: 'ok', message: 'History cleared' });
      return res.status(500).json({ error: 'Failed to clear JSONBin' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // --- METHOD POST: TERIMA SINYAL ATAU STATISTIK ---
  if (req.method === 'POST') {
    const data = req.body;
    if (data.secret !== WEBHOOK_SECRET) return res.status(403).json({ error: 'Forbidden' });

    try {
      const getRes = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
        headers: { 'X-Master-Key': JSONBIN_MASTER_KEY }
      });
      
      let currentData = { history: [], stats: {} };
      if (getRes.ok) currentData = (await getRes.json()).record || currentData;

      // JIKA PAYLOAD ADALAH UPDATE STATISTIK 5 MENITAN
      if (data.action === 'STATS') {
        currentData.stats = {
           balance: data.balance || 0,
           equity: data.equity || 0,
           realized_pnl: data.realized_pnl || 0,
           unrealized_pnl: data.unrealized_pnl || 0,
           drawdown: data.drawdown || 0,
           timestamp: new Date().toISOString()
        };
      } 
      // JIKA PAYLOAD ADALAH SINYAL TRADING
      else {
        const newSignal = {
          symbol: data.symbol?.toUpperCase(), action: data.action?.toUpperCase(),
          mode: (data.mode || 'NORMAL').toUpperCase(), price: parseFloat(data.price || 0),
          sl: parseFloat(data.sl || 0), tp: parseFloat(data.tp || 0),
          lots: parseFloat(data.lots || 0), pips: parseFloat(data.pips || 0),
          profit: parseFloat(data.profit || 0), comment: data.comment || '',
          status: data.status || 'OPEN', timestamp: new Date().toISOString()
        };
        currentData.history.unshift(newSignal);
        if (currentData.history.length > MAX_HISTORY) currentData.history = currentData.history.slice(0, MAX_HISTORY);
      }

      // SIMPAN KEMBALI KE JSONBIN
      const putRes = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_MASTER_KEY },
        body: JSON.stringify(currentData)
      });

      if (!putRes.ok) throw new Error('Failed to update JSONBin');
      return res.status(200).json({ status: 'ok' });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
