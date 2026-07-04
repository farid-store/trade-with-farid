<?php
/**
 * webhook.php
 * ------------------------------------------------------------
 * Jembatan antara EA MetaTrader 5 dan halaman web Farid Gold Killer.
 *
 * - EA MT5 kirim POST ke sini setiap ada entry/close/pending/modify + stats akun
 * - Halaman web (fetchSignals) kirim GET ke sini untuk ambil data terbaru
 * - Data disimpan di JSONBin (bin yang sama seperti jsonbinId di HTML)
 *
 * Upload file ini ke hosting/VPS kamu, lalu isi konfigurasi di bawah.
 * Contoh URL akhir: https://domainkamu.com/webhook.php
 * ------------------------------------------------------------
 */

// ====== KONFIGURASI ======
define('JSONBIN_ID',  '69f6caf536566621a81bc334');           // sama dengan jsonbinId di HTML
define('JSONBIN_KEY', '$2a$10$tcKHEWwuz2sqRoMCKJfga.1xxTFW0RxpXUPnP.NI4YbivtlK1xxau'); // X-Master-Key JSONBin
define('EA_SECRET',   'GANTI-DENGAN-KATA-SANDI-RAHASIA-EA');  // wajib diisi, dicek dari EA
define('MAX_HISTORY', 50);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-EA-Secret');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$binUrl = 'https://api.jsonbin.io/v3/b/' . JSONBIN_ID;

function jsonbin_get($binUrl) {
    $ch = curl_init($binUrl . '/latest');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['X-Master-Key: ' . JSONBIN_KEY],
    ]);
    $res = curl_exec($ch);
    curl_close($ch);
    $decoded = json_decode($res, true);
    return $decoded['record'] ?? ['history' => [], 'stats' => new stdClass()];
}

function jsonbin_put($binUrl, $data) {
    $ch = curl_init($binUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => 'PUT',
        CURLOPT_POSTFIELDS     => json_encode($data),
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'X-Master-Key: ' . JSONBIN_KEY,
        ],
    ]);
    curl_exec($ch);
    curl_close($ch);
}

// ====== GET: halaman web minta data terbaru ======
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode(jsonbin_get($binUrl));
    exit;
}

// ====== POST: EA MT5 kirim event baru ======
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $payload = json_decode($raw, true);

    // Validasi kata sandi EA (WAJIB, biar orang lain tidak bisa kirim data palsu)
    $secret = $_SERVER['HTTP_X_EA_SECRET'] ?? '';
    if ($secret !== EA_SECRET) {
        http_response_code(401);
        echo json_encode(['error' => 'unauthorized']);
        exit;
    }

    if (!$payload) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid json']);
        exit;
    }

    $record = jsonbin_get($binUrl);
    if (!isset($record['history']) || !is_array($record['history'])) $record['history'] = [];

    // Jika payload berisi "type: stats" -> update stats akun (balance/equity/floating)
    if (($payload['type'] ?? '') === 'stats') {
        $record['stats'] = [
            'balance'        => $payload['balance']        ?? 0,
            'equity'         => $payload['equity']          ?? 0,
            'unrealized_pnl' => $payload['unrealized_pnl']  ?? 0,
            'timestamp'      => $payload['timestamp']       ?? date('c'),
        ];
    } else {
        // Ini event sinyal (BUY/SELL/CLOSE/PENDING)
        $entry = [
            'symbol'    => $payload['symbol']    ?? '',
            'action'    => $payload['action']    ?? '',     // BUY / SELL / CLOSE / PENDING
            'status'    => $payload['status']    ?? '',     // PLACED / EXECUTED / MODIFIED / CLOSED
            'mode'      => $payload['mode']       ?? 'Normal',
            'price'     => $payload['price']     ?? 0,
            'sl'        => $payload['sl']        ?? 0,
            'tp'        => $payload['tp']        ?? 0,
            'lots'      => $payload['lots']      ?? 0,
            'pips'      => $payload['pips']      ?? 0,
            'profit'    => $payload['profit']    ?? null,
            'comment'   => $payload['comment']   ?? '',
            'timestamp' => $payload['timestamp'] ?? date('c'),
        ];
        array_unshift($record['history'], $entry);
        $record['history'] = array_slice($record['history'], 0, MAX_HISTORY);
    }

    jsonbin_put($binUrl, $record);
    echo json_encode(['success' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'method not allowed']);
