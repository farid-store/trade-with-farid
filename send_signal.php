<?php
/**
 * ╔═══════════════════════════════════════════════════════╗
 * ║  send_signal.php  –  Kirim sinyal MANUAL ke JSONBin  ║
 * ║  Gunakan untuk test / inject sinyal tanpa EA         ║
 * ╚═══════════════════════════════════════════════════════╝
 *
 * Akses via browser: https://yourdomain.com/send_signal.php
 * LINDUNGI FILE INI dengan htaccess atau password sebelum deploy!
 */

// ──────────────────────────────────────────────────
define('WEBHOOK_SECRET',    'farid_fx_secret_2024');
define('JSONBIN_BIN_ID',    'GANTI_BIN_ID_ANDA');
define('JSONBIN_MASTER_KEY','$2a$10$GANTI_MASTER_KEY');
define('MAX_HISTORY',        50);
// ──────────────────────────────────────────────────

$message = '';
$success = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $signal = [
        'symbol'    => strtoupper(trim($_POST['symbol']   ?? 'XAUUSD')),
        'action'    => strtoupper(trim($_POST['action']   ?? 'BUY')),
        'mode'      => strtoupper(trim($_POST['mode']     ?? 'NORMAL')),
        'price'     => (float)($_POST['price']            ?? 0),
        'sl'        => (float)($_POST['sl']               ?? 0),
        'tp'        => (float)($_POST['tp']               ?? 0),
        'lots'      => (float)($_POST['lots']             ?? 0.1),
        'pips'      => (float)($_POST['pips']             ?? 0),
        'profit'    => (float)($_POST['profit']           ?? 0),
        'comment'   => trim($_POST['comment']             ?? 'Manual'),
        'confidence'=> (int)($_POST['confidence']         ?? 75),
        'timestamp' => date('c'),
    ];

    $current  = jsonbin_get();
    if ($current === null) $current = ['history' => []];

    $history = $current['history'] ?? [];
    array_unshift($history, $signal);
    if (count($history) > MAX_HISTORY) $history = array_slice($history, 0, MAX_HISTORY);
    $current['history'] = $history;

    $result = jsonbin_put($current);
    if ($result) {
        $success = true;
        $message = '✅ Sinyal berhasil dikirim ke JSONBin!';
    } else {
        $message = '❌ Gagal menyimpan ke JSONBin. Cek config.';
    }
}

// ════════════════════════════════════════════════
function jsonbin_get(): ?array {
    $ch = curl_init('https://api.jsonbin.io/v3/b/' . JSONBIN_BIN_ID . '/latest');
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>['X-Master-Key: '.JSONBIN_MASTER_KEY], CURLOPT_TIMEOUT=>10]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code === 200 && $resp) { $j = json_decode($resp, true); return $j['record'] ?? null; }
    return null;
}
function jsonbin_put(array $payload): ?array {
    $ch = curl_init('https://api.jsonbin.io/v3/b/' . JSONBIN_BIN_ID);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_CUSTOMREQUEST=>'PUT', CURLOPT_POSTFIELDS=>json_encode($payload), CURLOPT_HTTPHEADER=>['Content-Type: application/json','X-Master-Key: '.JSONBIN_MASTER_KEY], CURLOPT_TIMEOUT=>10]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ($code===200||$code===201) ? json_decode($resp,true) : null;
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>FaridFX – Send Signal Manual</title>
<style>
  body { font-family: monospace; background:#050a0f; color:#c8dde8; padding:30px; }
  h2   { color:#00c8ff; letter-spacing:3px; margin-bottom:20px; }
  label{ display:block; margin-bottom:4px; font-size:.8rem; color:#4a7090; letter-spacing:1px; }
  input, select {
    display:block; width:300px; padding:8px 10px;
    background:#0a1520; border:1px solid #1a3a5c;
    color:#c8dde8; font-family:monospace; font-size:.9rem;
    margin-bottom:14px; border-radius:3px;
  }
  button {
    padding:10px 28px; background:#00c8ff; color:#050a0f;
    font-weight:700; font-family:monospace; font-size:.9rem;
    border:none; border-radius:3px; cursor:pointer;
    letter-spacing:2px; text-transform:uppercase;
  }
  button:hover { background:#00ff9d; }
  .msg {
    margin-top:16px; padding:12px 16px;
    border-radius:3px; font-size:.85rem; letter-spacing:1px;
    background: <?php echo $success ? 'rgba(0,255,157,.1)' : 'rgba(255,63,90,.1)'; ?>;
    border: 1px solid <?php echo $success ? 'rgba(0,255,157,.3)' : 'rgba(255,63,90,.3)'; ?>;
    color: <?php echo $success ? '#00ff9d' : '#ff3f5a'; ?>;
  }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:0 30px; max-width:640px; }
  a { color:#00c8ff; text-decoration:none; }
</style>
</head>
<body>
<h2>FARIDFX // SEND SIGNAL MANUAL</h2>
<p style="color:#4a7090;font-size:.75rem;margin-bottom:24px;letter-spacing:1px;">
  Halaman ini untuk test / inject sinyal tanpa EA. <a href="index.html">← Kembali ke dashboard</a>
</p>

<?php if ($message): ?>
<div class="msg"><?= htmlspecialchars($message) ?></div><br>
<?php endif; ?>

<form method="POST">
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
  <button type="submit">KIRIM SINYAL</button>
</form>
</body>
</html>
