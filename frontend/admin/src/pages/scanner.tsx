import { useState, useEffect, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface ScanResult {
  status: 'success' | 'error' | 'already';
  nama?: string;
  instansi?: string;
  message: string;
  time: string;
}

export function Scanner() {
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [manualToken, setManualToken] = useState('');
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startScanner = async () => {
    try {
      const { Html5Qrcode } = await import('html5-qrcode');

      if (scannerRef.current) {
        await scannerRef.current.stop();
      }

      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => handleScan(decodedText),
        () => {} // ignore errors during scanning
      );
      setScanning(true);
    } catch (err) {
      console.error('Scanner error:', err);
      alert('Gagal mengakses kamera. Pastikan browser memiliki izin kamera.');
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const handleScan = async (token: string) => {
    // Pause scanner temporarily to avoid duplicate scans
    if (scannerRef.current) {
      try { await scannerRef.current.pause(); } catch {}
    }

    try {
      const authToken = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/absensi/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      const now = new Date().toLocaleTimeString('id-ID');

      if (res.ok) {
        addResult({
          status: 'success',
          nama: data.nama,
          instansi: data.instansi,
          message: `${data.nama} berhasil absen`,
          time: now,
        });
        // Play success beep
        playBeep(true);
      } else if (res.status === 409) {
        addResult({
          status: 'already',
          nama: data.nama,
          message: `${data.nama} sudah tercatat hadir`,
          time: now,
        });
        playBeep(false);
      } else {
        addResult({
          status: 'error',
          message: data.error || 'QR code tidak valid',
          time: now,
        });
        playBeep(false);
      }
    } catch (err) {
      addResult({
        status: 'error',
        message: 'Gagal memvalidasi QR code',
        time: new Date().toLocaleTimeString('id-ID'),
      });
      playBeep(false);
    }

    // Resume scanner after 2s
    setTimeout(() => {
      if (scannerRef.current) {
        try { scannerRef.current.resume(); } catch {}
      }
    }, 2000);
  };

  const addResult = (result: ScanResult) => {
    setResults((prev) => [result, ...prev].slice(0, 10));
  };

  const playBeep = (success: boolean) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = success ? 800 : 300;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + (success ? 0.15 : 0.4));
    } catch {}
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualToken.trim()) {
      handleScan(manualToken.trim());
      setManualToken('');
    }
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Scanner QR Kehadiran</h1>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Scanner */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">📷 Kamera</h2>
            <button
              onClick={scanning ? stopScanner : startScanner}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                scanning
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-primary-600 hover:bg-primary-700 text-white'
              }`}
            >
              {scanning ? '⏹ Stop' : '▶ Mulai Scan'}
            </button>
          </div>

          <div
            ref={containerRef}
            id="qr-reader"
            className="w-full rounded-lg overflow-hidden bg-gray-900"
            style={{ minHeight: '300px' }}
          ></div>

          {/* Manual Input */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Atau masukkan kode secara manual:</p>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Masukkan token QR"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="submit"
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm transition"
              >
                Validasi
              </button>
            </form>
          </div>
        </div>

        {/* Results */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">📋 Riwayat Scan</h2>
          {results.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">📷</div>
              <p className="text-sm">Belum ada scan. Mulai scan QR code peserta.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border text-sm ${
                    r.status === 'success'
                      ? 'bg-green-50 border-green-200 text-green-800'
                      : r.status === 'already'
                      ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-medium">
                        {r.status === 'success' ? '✅' : r.status === 'already' ? '⚠️' : '❌'}{' '}
                        {r.message}
                      </span>
                      {r.instansi && <p className="text-xs mt-0.5 opacity-75">{r.instansi}</p>}
                    </div>
                    <span className="text-xs opacity-60">{r.time}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
