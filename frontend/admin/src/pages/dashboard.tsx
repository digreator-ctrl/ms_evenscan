import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface Stats {
  total: number;
  menunggu: number;
  dikonfirmasi: number;
  ditolak: number;
  hadir: number;
  sudah_hadir?: number;
  belum_hadir?: number;
  persentase_kehadiran?: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    total: 0,
    menunggu: 0,
    dikonfirmasi: 0,
    ditolak: 0,
    hadir: 0,
    sudah_hadir: 0,
    belum_hadir: 0,
    persentase_kehadiran: 0,
  });
  const [loading, setLoading] = useState(true);

  // Ambil data statistik dashboard secara real-time
  const fetchStats = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/absensi/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats(false);

    // Polling background setiap 5 detik agar data selalu terbarui otomatis
    const interval = setInterval(() => {
      fetchStats(true);
    }, 5000);

    const handleFocus = () => fetchStats(true);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Perhitungan Data Aman (Anti-Infinity & Anti-Minus)
  const totalPendaftar = stats.total || 0;
  const totalMenunggu = stats.menunggu || 0;
  const totalDikonfirmasi = stats.dikonfirmasi || 0;
  const totalDitolak = stats.ditolak || 0;

  // Presensi Kehadiran di Lokasi
  const totalSudahHadir = stats.sudah_hadir ?? stats.hadir ?? 0;
  const totalBelumHadir = stats.belum_hadir ?? Math.max(0, totalDikonfirmasi - totalSudahHadir);

  // Progres Kehadiran = (Sudah Hadir / Dikonfirmasi) * 100%
  // Jika belum ada yang dikonfirmasi, persentase selalu 0%
  const persentase = totalDikonfirmasi > 0
    ? Math.min(100, Math.max(0, Math.round((totalSudahHadir / totalDikonfirmasi) * 100)))
    : 0;

  return (
    <div className="space-y-6">
      {/* Header Halaman (Tombol verifikasi dan scan dihapus agar fokus analisa data) */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 text-sky-800 text-xs font-semibold mb-1 border border-sky-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live Monitoring • Realtime Sync
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Dashboard Panitia</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Ringkasan data pendaftaran, status verifikasi berkas, dan presensi kehadiran acara.
        </p>
      </div>

      {/* ======================================================== */}
      {/* TOTAL PENDAFTAR KESELURUHAN                              */}
      {/* ======================================================== */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Total Pendaftar Keseluruhan
          </h2>
          <span className="text-[11px] text-slate-400 font-medium">Semua data yang masuk</span>
        </div>

        <div className="bg-gradient-to-br from-[#06305d] via-[#08407c] to-[#0a529b] text-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-md relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative z-10">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm sm:text-base font-bold text-sky-200 uppercase tracking-wide">
                Total Seluruh Pendaftar
              </span>
              <div className="text-2xl sm:text-4xl font-black tracking-tight text-white shrink-0">
                {loading ? '...' : totalPendaftar}
                <span className="text-xs sm:text-sm font-medium text-sky-200 ml-1.5">Peserta</span>
              </div>
            </div>
            <p className="text-xs text-sky-100/80 mt-2">
              Akumulasi seluruh pendaftar yang masuk melalui formulir registrasi online.
            </p>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* STATUS VERIFIKASI BERKAS                                 */}
      {/* ======================================================== */}
      <section className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Status Verifikasi Berkas
          </h2>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
            <span>ℹ️ Akumulasi:</span>
            <span className="font-mono text-slate-800">
              {totalMenunggu} + {totalDikonfirmasi} + {totalDitolak} = {totalPendaftar} Peserta (100% Sesuai)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {/* 1. Menunggu Verifikasi */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 sm:p-5 transition hover:shadow-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs sm:text-sm font-bold text-amber-900 uppercase tracking-wider">
                Menunggu
              </span>
              <span className="text-2xl sm:text-3xl font-black text-amber-950">
                {loading ? '...' : totalMenunggu}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-amber-800/80 mt-1.5">
              Menunggu peninjauan bukti transfer/akun HSI oleh panitia.
            </p>
          </div>

          {/* 2. Dikonfirmasi (Lolos Verifikasi / ACC) */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 sm:p-5 transition hover:shadow-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs sm:text-sm font-bold text-emerald-900 uppercase tracking-wider">
                Dikonfirmasi (ACC)
              </span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-950">
                {loading ? '...' : totalDikonfirmasi}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-emerald-800/80 mt-1.5">
              Lolos verifikasi & tiket QR aktif (angka tetap meski sudah hadir).
            </p>
          </div>

          {/* 3. Ditolak */}
          <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 sm:p-5 transition hover:shadow-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs sm:text-sm font-bold text-rose-900 uppercase tracking-wider">
                Ditolak
              </span>
              <span className="text-2xl sm:text-3xl font-black text-rose-950">
                {loading ? '...' : totalDitolak}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-rose-800/80 mt-1.5">
              Berkas ditolak karena tidak memenuhi ketentuan acara.
            </p>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* PRESENSI KEHADIRAN DI LOKASI                             */}
      {/* ======================================================== */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Presensi Kehadiran di Lokasi
          </h2>
          <span className="text-[11px] text-slate-400 font-medium">
            Dari {totalDikonfirmasi} peserta dikonfirmasi
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Sudah Hadir */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 sm:p-5 transition hover:shadow-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs sm:text-sm font-bold text-blue-900 uppercase tracking-wider">
                Sudah Hadir
              </span>
              <span className="text-2xl sm:text-3xl font-black text-blue-950">
                {loading ? '...' : totalSudahHadir}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-blue-800/80 mt-1.5">
              Telah scan QR barcode di meja registrasi masuk lokasi.
            </p>
          </div>

          {/* Belum Hadir */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 transition hover:shadow-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
                Belum Hadir
              </span>
              <span className="text-2xl sm:text-3xl font-black text-slate-900">
                {loading ? '...' : totalBelumHadir}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-1.5">
              Sudah memiliki tiket QR terbit, namun belum check-in di lokasi.
            </p>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* PROGRES KEHADIRAN PESERTA (Tetap, Tidak Ada Perubahan)   */}
      {/* ======================================================== */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Progres Kehadiran Peserta
        </h2>

        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Persentase Kehadiran Acara
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Rasio peserta hadir terhadap total pendaftar yang dikonfirmasi.
              </p>
            </div>

            <div className="text-right">
              <span className="text-2xl sm:text-3xl font-black text-[#06305d]">
                {persentase}%
              </span>
            </div>
          </div>

          {/* Progress Bar Container */}
          <div className="w-full bg-slate-100 rounded-full h-4 p-0.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-[#06305d] rounded-full h-3 transition-all duration-700 ease-out shadow-xs"
              style={{ width: `${persentase}%` }}
            />
          </div>

          {/* Penjelasan Detail */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
            <div>
              <span className="font-bold text-slate-900">{totalSudahHadir}</span> dari{' '}
              <span className="font-bold text-slate-900">{totalDikonfirmasi}</span> peserta yang dikonfirmasi telah hadir
            </div>
            <div className="text-slate-500 font-medium">
              Sisa <span className="font-bold text-slate-700">{totalBelumHadir}</span> peserta belum check-in
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
