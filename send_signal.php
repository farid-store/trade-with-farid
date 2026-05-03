<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FaridFX – Send Signal Manual</title>
<style>
  body { font-family: monospace; background:#050a0f; color:#c8dde8; padding:30px; }
  h2   { color:#00c8ff; letter-spacing:3px; margin-bottom:20px; }
  label{ display:block; margin-bottom:4px; font-size:.8rem; color:#4a7090; letter-spacing:1px; }
  input, select {
    display:block; width:100%; max-width: 300px; padding:8px 10px;
    background:#0a1520; border:1px solid #1a3a5c;
    color:#c8dde8; font-family:monospace; font-size:.9rem;
    margin-bottom:14px; border-radius:3px; box-sizing: border-box;
  }
  button {
    padding:10px 28px; background:#00c8ff; color:#050a0f;
    font-weight:700; font-family:monospace; font-size:.9rem;
    border:none; border-radius:3px; cursor:pointer;
    letter-spacing:2px; text-transform:uppercase;
    transition: background 0.3s;
  }
  button:hover { background:#00ff9d; }
  button:disabled { background: #4a7090; cursor: not-allowed; }
  
  /* Class notifikasi dinamis */
  .msg {
    margin-top:16px; padding:12px 16px; margin-bottom: 20px;
    border-radius:3px; font-size:.85rem; letter-spacing:1px;
    display: none; /* Disembunyikan secara default */
  }
  .msg.success {
    background: rgba(0,255,157,.1);
    border: 1px solid rgba(0,255,157,.3);
    color: #00ff9d;
  }
  .msg.error {
    background: rgba(255,63,90,.1);
    border: 1px solid rgba(255,63,90,.3);
    color: #ff3f5a;
  }
  
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:0 30px; max-width:640px; }
  a { color:#00c8ff; text-decoration:none; }
  
  /* Responsif untuk HP */
  @media (max-width: 600px) {
    .grid { grid-template-columns: 1fr; }
    input, select { max-width: 100%; }
  }
</style>
</head>
<body>

<h2>FARIDFX // SEND SIGNAL MANUAL</h2>
<p style="color:#4a7090;font-size:.75rem;margin-bottom:24px;letter-spacing:1px;">
  Halaman ini untuk test / inject sinyal manual ke API Vercel.
</p>

<!-- Kotak Pesan Notifikasi -->
<div id="messageBox" class="msg"></div>

<form id="signalForm">
  <div class="grid">
    <div>
      <label>SYMBOL</label>
      <input name="symbol" value="XAUUSD" required>
      <label>ACTION</label>
      <select name="action">
        <option>BUY</option><option>SELL</option><option>CLOSE</option><option>PENDING</option>
      </select>
      <label>MODE</label>
      <select name="mode">
        <option>NORMAL</option><option>WAR</option><option>LAYER</option>
      </select>
      <label>PRICE (ENTRY)</label>
      <input name="price" type="number" step="0.00001" value="0">
      <label>STOP LOSS</label>
      <input name="sl" type="number" step="0.00001" value="0">
    </div>
    <div>
      <label>TAKE PROFIT</label>
      <input name="tp" type="number" step="0.00001" value="0">
      <label>LOT SIZE</label>
      <input name="lots" type="number" step="0.01" value="0.10">
      <label>PROFIT (utk CLOSE)</label>
      <input name="profit" type="number" step="0.01" value="0">
      <label>AI CONFIDENCE (%)</label>
      <input name="confidence" type="number" min="0" max="100" value="75">
      <label>COMMENT</label>
      <input name="comment" value="Manual Test">
    </div>
  </div>
  <button type="submit" id="submitBtn">KIRIM SINYAL</button>
</form>

<script>
  const form = document.getElementById('signalForm');
  const msgBox = document.getElementById('messageBox');
  const submitBtn = document.getElementById('submitBtn');

  // Ganti WEBHOOK_SECRET dengan yang Anda setting di API Vercel
  const API_SECRET = 'farid_1124'; 
  
  // URL API (Karena di-host di Vercel yang sama, cukup gunakan path relatif)
  const API_URL = '/api/webhook'; 

  form.addEventListener('submit', async (e) => {
    e.preventDefault(); // Mencegah halaman reload
    
    // Ubah tampilan tombol saat loading
    submitBtn.innerText = 'MENGIRIM...';
    submitBtn.disabled = true;
    msgBox.style.display = 'none';
    msgBox.className = 'msg';

    // Susun payload JSON dari input form
    const payload = {
      secret: API_SECRET,
      symbol: form.symbol.value,
      action: form.action.value,
      mode: form.mode.value,
      price: parseFloat(form.price.value),
      sl: parseFloat(form.sl.value),
      tp: parseFloat(form.tp.value),
      lots: parseFloat(form.lots.value),
      profit: parseFloat(form.profit.value),
      confidence: parseInt(form.confidence.value),
      comment: form.comment.value,
      status: 'MANUAL' // Menandakan ini dikirim dari web, bukan dari EA MT5
    };

    try {
      // Kirim data ke Vercel API Endpoint
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok) {
        // Tampilkan pesan sukses
        msgBox.innerHTML = '✅ Sinyal manual berhasil diteruskan ke JSONBin!';
        msgBox.classList.add('success');
      } else {
        // Tampilkan error dari backend
        msgBox.innerHTML = '❌ Gagal: ' + (result.error || 'Terjadi kesalahan');
        msgBox.classList.add('error');
      }
    } catch (error) {
      // Tampilkan error jaringan/koneksi
      msgBox.innerHTML = '❌ Gagal menghubungi API Vercel. Cek koneksi Anda.';
      msgBox.classList.add('error');
    }

    // Tampilkan kotak pesan dan kembalikan tombol
    msgBox.style.display = 'block';
    submitBtn.innerText = 'KIRIM SINYAL';
    submitBtn.disabled = false;
  });
</script>
</body>
</html>
