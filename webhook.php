<?php
/**
 * ╔════════════════════════════════════════════════╗
 * ║  webhook.php  –  FaridFX MT5 Signal Bridge     ║
 * ║  Menerima sinyal dari EA → simpan ke JSONBin   ║
 * ╚════════════════════════════════════════════════╝
 *
 * Letakkan file ini di root web server Anda.
 * URL ini yang diisi di InpWebhookURL pada EA.
 */

// ──────────────────────────────────────────────────
//  CONFIG  –  WAJIB DIISI
// ──────────────────────────────────────────────────
define('WEBHOOK_SECRET',    'farid_1124');   // harus sama dengan InpWebhookSecret di EA
define('JSONBIN_BIN_ID',    '69f6caf536566621a81bc334');       // ID bin dari jsonbin.io
define('JSONBIN_MASTER_KEY','$2a$10$tcKHEWwuz2sqRoMCKJfga.1xxTFW0RxpXUPnP.NI4YbivtlK1xxau'); // Master Key dari jsonbin.io
define('MAX_HISTORY',        50);                        // jumlah riwayat sinyal yang disimpan
// ──────────────────────────────────────────────────

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Hanya terima POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    die(json_encode(['error' => 'Method not allowed']));
}

// ── Baca body ──
$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);

if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
    http_response_code(400);
    die(json_encode(['error' => 'Invalid JSON']));
}

// ── Validasi secret ──
$secret = $data['secret'] ?? '';
if ($secret !== WEBHOOK_SECRET) {
    http_response_code(403);
    die(json_encode(['error' => 'Forbidden: invalid secret']));
}

// ── Validasi field wajib ──
$required = ['symbol', 'action', 'price'];
foreach ($required as $f) {
    if (!isset($data[$f])) {
        http_response_code(422);
        die(json_encode(['error' => "Missing field: $f"]));
    }
}

// ── Bangun objek sinyal baru ──
$signal = [
    'symbol'     => strtoupper(trim($data['symbol'])),
    'action'     => strtoupper(trim($data['action'])),
    'mode'       => strtoupper(trim($data['mode']     ?? 'NORMAL')),
    'price'      => (float)($data['price']            ?? 0),
    'sl'         => (float)($data['sl']               ?? 0),
    'tp'         => (float)($data['tp']               ?? 0),
    'lots'       => (float)($data['lots']             ?? 0),
    'pips'       => (float)($data['pips']             ?? 0),
    'profit'     => (float)($data['profit']           ?? 0),
    'comment'    => trim($data['comment']             ?? ''),
    'confidence' => isset($data['confidence']) ? (int)$data['confidence'] : null,
    'timestamp'  => date('c'),          // ISO 8601
];

// ── Ambil data lama dari JSONBin ──
$current = jsonbin_get();

if ($current === null) {
    // Bin belum ada / pertama kali → buat struktur awal
    $current = ['history' => []];
}

// ── Prepend sinyal baru ke history ──
$history = $current['history'] ?? [];
array_unshift($history, $signal);

// Batasi jumlah history
if (count($history) > MAX_HISTORY) {
    $history = array_slice($history, 0, MAX_HISTORY);
}

$current['history'] = $history;

// ── Simpan ke JSONBin ──
$result = jsonbin_put($current);

if ($result === null) {
    http_response_code(500);
    die(json_encode(['error' => 'Failed to save to JSONBin']));
}

// ── Respons sukses ──
http_response_code(200);
echo json_encode([
    'status'    => 'ok',
    'signal'    => $signal,
    'history_count' => count($history),
]);

// ════════════════════════════════════════════════
//  JSONBIN HELPER FUNCTIONS
// ════════════════════════════════════════════════

/**
 * GET – ambil isi bin saat ini
 */
function jsonbin_get(): ?array {
    $url = 'https://api.jsonbin.io/v3/b/' . JSONBIN_BIN_ID . '/latest';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            'X-Master-Key: ' . JSONBIN_MASTER_KEY,
        ],
        CURLOPT_TIMEOUT => 10,
    ]);

    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code === 200 && $resp) {
        $json = json_decode($resp, true);
        return $json['record'] ?? null;
    }

    // Bin baru belum ada record (404 saat pertama kali)
    return null;
}

/**
 * PUT – update isi bin
 */
function jsonbin_put(array $payload): ?array {
    $url = 'https://api.jsonbin.io/v3/b/' . JSONBIN_BIN_ID;

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => 'PUT',
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'X-Master-Key: ' . JSONBIN_MASTER_KEY,
        ],
        CURLOPT_TIMEOUT => 10,
    ]);

    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if (($code === 200 || $code === 201) && $resp) {
        return json_decode($resp, true);
    }

    error_log("[FaridFX webhook] JSONBin PUT failed – HTTP $code – $resp");
    return null;
}
