import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface ParticipantData {
  id: string;
  nama: string;
  email: string;
  no_whatsapp: string;
  instansi: string;
  status: 'menunggu' | 'dikonfirmasi' | 'hadir' | 'ditolak';
  qr_token: string;
  attended_at: string | null;
  created_at: string;
  confirmed_at: string | null;
}

export function Scanner() {

  // Scanner State
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState('');
  const [manualToken, setManualToken] = useState('');

  // Verifikasi Data Peserta yang Di-scan
  const [scannedParticipant, setScannedParticipant] = useState<ParticipantData | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmSuccess, setConfirmSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const scannerRef = useRef<any>(null);
  const isProcessingRef = useRef<boolean>(false);

  // Auto-start kamera saat halaman dibuka (Fast Action Scanner)
  useEffect(() => {
    let isMounted = true;

    const initCamera = async () => {
      // Beri sedikit jeda agar DOM element #qr-reader ter-render sepenuhnya
      await new Promise((r) => setTimeout(r, 250));
      if (isMounted) {
        await startScanner();
      }
    };

    initCamera();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    setCameraLoading(true);
    setCameraError('');

    try {
      const { Html5Qrcode } = await import('html5-qrcode');

      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch {}
      }

      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 12,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
        },
        (decodedText: string) => {
          handleDetectedCode(decodedText);
        },
        () => {
          // Abaikan frame tanpa barcode
        }
      );

      setCameraActive(true);
      setCameraLoading(false);
    } catch (err: any) {
      console.error('Kamera error:', err);
      setCameraActive(false);
      setCameraLoading(false);
      setCameraError(
        'Tidak dapat mengakses kamera. Pastikan browser memiliki izin akses kamera atau masukkan kode token secara manual.'
      );
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
    setCameraActive(false);
  };

  // Suara Beep / Chime interaktif
  const playBeep = (type: 'scan' | 'success' | 'warning' | 'error') => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'scan') {
        osc.frequency.value = 850;
        gain.gain.value = 0.25;
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'success') {
        // Melodi sukses presensi
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
        gain.gain.value = 0.35;
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'warning') {
        osc.frequency.value = 350;
        gain.gain.value = 0.3;
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.frequency.value = 220;
        gain.gain.value = 0.4;
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch {}
  };

  // Ketika kamera berhasil membaca QR Code
  const handleDetectedCode = async (rawCode: string) => {
    if (isProcessingRef.current || scannedParticipant || lookupLoading) {
      return;
    }

    isProcessingRef.current = true;
    playBeep('scan');

    // Pause kamera sementara agar tidak trigger berulang kali
    if (scannerRef.current) {
      try {
        await scannerRef.current.pause();
      } catch {}
    }

    await lookupParticipant(rawCode.trim());
  };

  // Mencari dan menampilkan preview data peserta berdasarkan token QR
  const lookupParticipant = async (token: string) => {
    setLookupLoading(true);
    setErrorMessage('');
    setConfirmSuccess(false);

    try {
      const authToken = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/absensi/lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token }),
      });

      const json = await res.json();

      if (res.ok && json.data) {
        setScannedParticipant(json.data);
        if (json.data.status === 'hadir') {
          playBeep('warning');
        }
      } else {
        playBeep('error');
        setErrorMessage(json.error || 'QR Code tidak terdaftar di sistem');
      }
    } catch (err: any) {
      playBeep('error');
      setErrorMessage('Terjadi gangguan saat memvalidasi QR: ' + err.message);
    } finally {
      setLookupLoading(false);
    }
  };

  // Tombol Admin Konfirmasi Kehadiran
  const handleConfirmAttendance = async () => {
    if (!scannedParticipant) return;

    setConfirmLoading(true);
    try {
      const authToken = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/absensi/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token: scannedParticipant.qr_token }),
      });

      const json = await res.json();

      if (res.ok) {
        playBeep('success');
        setConfirmSuccess(true);
        // Update state lokal menjadi 'hadir'
        setScannedParticipant({
          ...scannedParticipant,
          status: 'hadir',
          attended_at: json.attended_at || new Date().toISOString(),
        });
      } else {
        playBeep('error');
        alert(json.error || 'Gagal mengonfirmasi kehadiran');
      }
    } catch (err: any) {
      playBeep('error');
      alert('Terjadi kesalahan koneksi saat konfirmasi');
    } finally {
      setConfirmLoading(false);
    }
  };

  // Lanjut scan peserta berikutnya
  const handleNextScan = async () => {
    setScannedParticipant(null);
    setConfirmSuccess(false);
    setErrorMessage('');
    isProcessingRef.current = false;

    // Resume kamera kembali
    if (scannerRef.current) {
      try {
        await scannerRef.current.resume();
      } catch {}
    } else {
      await startScanner();
    }
  };

  // Submit manual
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualToken.trim()) {
      handleDetectedCode(manualToken.trim());
      setManualToken('');
    }
  };

  // Format tanggal & jam
  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-1 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Fast Action Scanner Presensi
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Scanner QR Kehadiran</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Arahkan kamera ke QR code tiket peserta. Data peserta akan muncul untuk diverifikasi sebelum dikonfirmasi hadir.
          </p>
        </div>

        <Link
          to="/riwayat-scan"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 shadow-xs transition active:scale-95 shrink-0"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Buka Riwayat Scan</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* SISI KIRI: KAMERA LIVE SCANNER */}
        <div className="md:col-span-7 bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-bold text-slate-800">
                  {cameraActive ? 'Kamera Aktif & Siap Memindai' : 'Kamera Menghubungkan...'}
                </span>
              </div>

              {cameraActive && (
                <button
                  onClick={startScanner}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                  title="Mulai Ulang Kamera"
                >
                  Reset Kamera
                </button>
              )}
            </div>

            {/* Viewfinder Kamera */}
            <div className="relative w-full rounded-2xl overflow-hidden bg-slate-950 aspect-square flex items-center justify-center border-2 border-slate-800">
              {/* HTML5 QR Code Mount Element */}
              <div id="qr-reader" className="w-full h-full object-cover"></div>

              {/* Viewfinder Frame Animasi Laser */}
              {cameraActive && !scannedParticipant && !lookupLoading && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-56 h-56 border-2 border-dashed border-white/60 rounded-3xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                    {/* Sudut Frame */}
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-sky-400 rounded-tl-xl" />
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-sky-400 rounded-tr-xl" />
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-sky-400 rounded-bl-xl" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-sky-400 rounded-br-xl" />

                    {/* Garis Laser Animasi */}
                    <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-pulse top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              )}

              {/* Loading Indicator Kamera */}
              {cameraLoading && (
                <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4 text-center z-10">
                  <div className="w-8 h-8 border-3 border-sky-400 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-xs font-semibold">Mengaktifkan kamera perangkat...</p>
                </div>
              )}

              {/* Error Message Kamera */}
              {cameraError && (
                <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center text-white p-6 text-center z-10">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <p className="text-xs font-medium text-slate-300 mb-4 max-w-xs">{cameraError}</p>
                  <button
                    onClick={startScanner}
                    className="px-4 py-2 bg-[#06305d] hover:bg-[#0a4583] text-white text-xs font-bold rounded-xl transition active:scale-95 shadow-md"
                  >
                    Coba Akses Kamera Lagi
                  </button>
                </div>
              )}

              {/* Overlay Sedang Membaca QR */}
              {lookupLoading && (
                <div className="absolute inset-0 bg-slate-900/75 backdrop-blur-xs flex flex-col items-center justify-center text-white z-20">
                  <div className="w-9 h-9 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-xs font-bold tracking-wide">Membaca Data Tiket...</p>
                </div>
              )}
            </div>
          </div>

          {/* Form Input Token Manual */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[11px] font-semibold text-slate-500 mb-1.5">
              Atau input kode QR Token secara manual:
            </p>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Contoh: qr_12345678"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#06305d]/20 focus:border-[#06305d]"
              />
              <button
                type="submit"
                disabled={!manualToken.trim() || lookupLoading}
                className="px-4 py-2 bg-[#06305d] hover:bg-[#0a4583] text-white text-xs font-bold rounded-xl transition active:scale-95 disabled:opacity-50"
              >
                Cek Data
              </button>
            </form>
          </div>
        </div>

        {/* SISI KANAN: CARD HASIL SCAN & VERIFIKASI SEBELUM DIKONFIRMASI */}
        <div className="md:col-span-5 flex flex-col">
          {!scannedParticipant && !errorMessage ? (
            /* STATE 1: STANDBY MENUNGGU SCAN */
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <h3 className="text-base font-black text-slate-800 mb-1">Siap Memindai Tiket</h3>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed mb-4">
                Posisikan QR Code tiket peserta di dalam kotak kamera. Setelah terdeteksi, data peserta akan langsung muncul di sini untuk dikonfirmasi.
              </p>
              <div className="p-3 bg-sky-50 rounded-2xl border border-sky-100 text-[11px] text-sky-800 max-w-xs text-left space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <span>💡</span> Alur Presensi:
                </p>
                <p>1. Scan QR Tiket Peserta</p>
                <p>2. Cek nama & instansi peserta</p>
                <p>3. Klik tombol konfirmasi untuk mencatat kehadiran ke riwayat</p>
              </div>
            </div>
          ) : errorMessage ? (
            /* STATE 2: ERROR SCAN TIDAK VALID */
            <div className="bg-white rounded-3xl p-6 border border-rose-200 shadow-xs flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3 border border-rose-200">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-base font-black text-slate-800 mb-1">QR Code Tidak Valid</h3>
              <p className="text-xs text-rose-600 font-medium mb-5 max-w-xs">{errorMessage}</p>
              <button
                onClick={handleNextScan}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition active:scale-95"
              >
                Scan Ulang Tiket Lain
              </button>
            </div>
          ) : (
            /* STATE 3: DATA PESERTA MUNCUL UNTUK DIVERIFIKASI ADMIN */
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-lg flex-1 flex flex-col justify-between animate-in fade-in zoom-in-95 duration-150">
              <div>
                {/* Status Badge */}
                <div className="mb-4">
                  {scannedParticipant?.status === 'dikonfirmasi' ? (
                    <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-800 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shrink-0" />
                      <div>
                        <p className="text-xs font-bold leading-tight">✓ Tiket Valid & Terkonfirmasi</p>
                        <p className="text-[10px] text-emerald-700">Silakan pastikan identitas peserta sebelum konfirmasi hadir.</p>
                      </div>
                    </div>
                  ) : scannedParticipant?.status === 'hadir' ? (
                    <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 flex items-center gap-2">
                      <span className="text-base shrink-0">⚠️</span>
                      <div>
                        <p className="text-xs font-black leading-tight text-amber-900">
                          PERINGATAN: SUDAH HADIR SEBELUMNYA!
                        </p>
                        <p className="text-[10px] text-amber-800 mt-0.5">
                          Telah di-scan pada: {formatDateTime(scannedParticipant.attended_at)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 text-rose-900 flex items-center gap-2">
                      <span className="text-base shrink-0">✕</span>
                      <div>
                        <p className="text-xs font-bold leading-tight">Status Pendaftar: {scannedParticipant?.status}</p>
                        <p className="text-[10px] text-rose-700">Tiket ini belum disetujui untuk presensi.</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notifikasi Kehadiran Berhasil Dikonfirmasi */}
                {confirmSuccess && (
                  <div className="mb-4 p-3 bg-emerald-600 text-white rounded-2xl shadow-md text-xs font-bold flex items-center gap-2">
                    <span className="text-lg">🎉</span>
                    <div>
                      <p>Presensi Berhasil Dikonfirmasi!</p>
                      <p className="text-[10px] font-normal opacity-90">Data telah otomatis masuk ke menu Riwayat Scan.</p>
                    </div>
                  </div>
                )}

                {/* Data Profil Peserta */}
                <div className="space-y-3.5">
                  <div className="border-b border-slate-100 pb-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nama Peserta</p>
                    <h3 className="text-xl font-black text-slate-900 mt-0.5 leading-tight">
                      {scannedParticipant?.nama}
                    </h3>
                    <p className="text-xs text-sky-700 font-semibold mt-0.5">
                      {scannedParticipant?.instansi || 'Peserta Umum'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-slate-50 rounded-xl">
                      <p className="text-[10px] text-slate-400 font-medium">No. WhatsApp</p>
                      <p className="font-bold text-slate-800 mt-0.5 truncate">{scannedParticipant?.no_whatsapp}</p>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl">
                      <p className="text-[10px] text-slate-400 font-medium">QR Token</p>
                      <p className="font-mono font-bold text-slate-800 mt-0.5 truncate">{scannedParticipant?.qr_token}</p>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl text-xs">
                    <p className="text-[10px] text-slate-400 font-medium">Email Terdaftar</p>
                    <p className="font-semibold text-slate-800 mt-0.5 truncate">{scannedParticipant?.email || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
                {scannedParticipant?.status === 'dikonfirmasi' && !confirmSuccess ? (
                  <>
                    <button
                      onClick={handleConfirmAttendance}
                      disabled={confirmLoading}
                      className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black tracking-wide shadow-md hover:shadow-lg transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {confirmLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Mengonfirmasi Kehadiran...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                          </svg>
                          <span>KONFIRMASI HADIR SEKARANG</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleNextScan}
                      disabled={confirmLoading}
                      className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                    >
                      Batal & Scan Ulang
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleNextScan}
                      className="w-full py-3 rounded-2xl bg-[#06305d] hover:bg-[#0a4583] text-white text-xs font-bold shadow-md transition active:scale-95 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <span>Scan Peserta Berikutnya</span>
                    </button>

                    <Link
                      to="/riwayat-scan"
                      className="block w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold text-center transition"
                    >
                      Lihat di Menu Riwayat Scan
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
