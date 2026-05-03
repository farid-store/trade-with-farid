// File: api/webhook.js

export default async function handler(req, res) {
  // 1. Setup CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Ambil Config dari Vercel Environment Variables
  // (Pastikan Anda menambahkan ini di menu Settings > Environment Variables di dashboard Vercel)
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'farid_1124';
  const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID || '69f6caf536566621a81bc334';
  const JSONBIN_MASTER_KEY = process.env.JSONBIN_MASTER_KEY || '$2a$10$tcKHEWwuz2sqRoMCKJfga.1xxTFW0RxpXUPnP.NI4YbivtlK1xxau';
  const MAX_HISTORY = 50;

  const data = req.body;

  // 3. Validasi Secret
  if (data.secret !== WEBHOOK_SECRET) {
    return res.status(403).json({ error: 'Forbidden: invalid secret' });
  }

  // 4. Validasi Field Wajib
  if (!data.symbol || !data.action || data.price === undefined) {
    return res.status(422).json({ error: 'Missing required fields' });
  }

  // 5. Susun Data Sinyal Baru
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
    status: data.status || 'OPEN', // Tambahan penting untuk MT5 (PENDING, FILLED, CLOSED)
    timestamp: new Date().toISOString()
  };

  try {
    // 6. GET Data Lama dari JSONBin
    const getRes = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
      method: 'GET',
      headers: { 'X-Master-Key': JSONBIN_MASTER_KEY }
    });
    
    let currentData = { history: [] };
    if (getRes.ok) {
      const parsed = await getRes.json();
      currentData = parsed.record || { history: [] };
    }

    // 7. Masukkan Sinyal Baru & Batasi History
    currentData.history.unshift(newSignal);
    if (currentData.history.length > MAX_HISTORY) {
      currentData.history = currentData.history.slice(0, MAX_HISTORY);
    }

    // 8. PUT Data Baru ke JSONBin
    const putRes = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_MASTER_KEY
      },
      body: JSON.stringify(currentData)
    });

    if (!putRes.ok) {
      throw new Error('Failed to update JSONBin');
    }

    return res.status(200).json({ status: 'ok', signal: newSignal });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
