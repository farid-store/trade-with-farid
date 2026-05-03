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
  const MAX_HISTORY = 50;

  // --- METHOD GET: AMBIL HISTORY ---
  if (req.method === 'GET') {
    try {
      const getRes = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
        method: 'GET',
        headers: { 'X-Master-Key': JSONBIN_MASTER_KEY }
      });
      if (getRes.ok) {
        const parsed = await getRes.json();
        return res.status(200).json(parsed.record || { history: [] });
      }
      return res.status(500).json({ error: 'Failed to fetch from JSONBin' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // --- METHOD DELETE: CLEAR HISTORY ---
  if (req.method === 'DELETE') {
    // Validasi secret via header (karena DELETE biasanya tidak bawa body)
    if (req.headers['x-secret'] !== WEBHOOK_SECRET) {
      return res.status(403).json({ error: 'Forbidden: invalid secret' });
    }
    try {
      const putRes = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': JSONBIN_MASTER_KEY
        },
        body: JSON.stringify({ history: [] }) // Kosongkan array
      });
      if (putRes.ok) return res.status(200).json({ status: 'ok', message: 'History cleared' });
      return res.status(500).json({ error: 'Failed to clear JSONBin' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // --- METHOD POST: TERIMA SINYAL ---
  if (req.method === 'POST') {
    const data = req.body;

    if (data.secret !== WEBHOOK_SECRET) {
      return res.status(403).json({ error: 'Forbidden: invalid secret' });
    }

    if (!data.symbol || !data.action || data.price === undefined) {
      return res.status(422).json({ error: 'Missing required fields' });
    }

    const newSignal = {
      symbol: data.symbol.toUpperCase(),
      action: data.action.toUpperCase(),
      mode: (data.mode || 'NORMAL').toUpperCase(),
      price: parseFloat(data.price || 0),
      sl: parseFloat(data.sl || 0),
      tp: parseFloat(data.tp || 0),
      lots: parseFloat(data.lots || 0),
      pips: parseFloat(data.pips || 0),
      profit: parseFloat(data.profit || 0),
      comment: data.comment || '',
      status: data.status || 'OPEN',
      timestamp: new Date().toISOString()
    };

    try {
      const getRes = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
        method: 'GET',
        headers: { 'X-Master-Key': JSONBIN_MASTER_KEY }
      });
      
      let currentData = { history: [] };
      if (getRes.ok) {
        const parsed = await getRes.json();
        currentData = parsed.record || { history: [] };
      }

      currentData.history.unshift(newSignal);
      if (currentData.history.length > MAX_HISTORY) {
        currentData.history = currentData.history.slice(0, MAX_HISTORY);
      }

      const putRes = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': JSONBIN_MASTER_KEY
        },
        body: JSON.stringify(currentData)
      });

      if (!putRes.ok) throw new Error('Failed to update JSONBin');
      return res.status(200).json({ status: 'ok', signal: newSignal });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
