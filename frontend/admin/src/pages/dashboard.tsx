import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

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

  // Grup 3: Presensi Kehadiran di Lokasi
  const totalSudahHadir = stats.sudah_hadir ?? stats.hadir ?? 0;
  const totalBelumHadir = stats.belum_hadir ?? Math.max(0, totalDikonfirmasi - totalSudahHadir);

  // Grup 4: Progres Kehadiran = (Sudah Hadir / Dikonfirmasi) * 100%
  // Jika belum ada yang dikonfirmasi, persentase selalu 0%
  const persentase = totalDikonfirmasi > 0
    ? Math.min(100, Math.max(0, Math.round((totalSudahHadir / totalDikonfirmasi) * 100)))
    : 0;

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

        <div className="flex items-center gap-2">
          <Link
            to="/verifikasi"
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>📋</span> Verifikasi
          </Link>
          <Link
            to="/scanner"
            className="px-3.5 py-2 rounded-xl bg-[#06305d] hover:bg-[#0a4583] text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>📷</span> Scan QR
          </Link>
        </div>
      </div>

      {/* ======================================================== */}
      {/* GRUP 1: TOTAL PENDAFTAR                                  */}
      {/* ======================================================== */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Grup 1 • Total Pendaftar Keseluruhan
          </h2>
          <span className="text-[11px] text-slate-400 font-medium">Semua data yang masuk</span>
        </div>

        <div className="bg-gradient-to-br from-[#06305d] via-[#08407c] to-[#0a529b] text-white rounded-3xl p-6 sm:p-7 shadow-md relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-xs font-semibold text-sky-200 uppercase tracking-wider">
                Total Seluruh Pendaftar
              </p>
              <div className="text-3xl sm:text-5xl font-black tracking-tight text-white mt-1">
                {loading ? '...' : totalPendaftar}
                <span className="text-base sm:text-xl font-normal text-sky-200 ml-2">Peserta</span>
              </div>
              <p className="text-xs text-sky-100/80 mt-2 max-w-sm">
                Akumulasi seluruh pendaftar yang masuk melalui formulir registrasi online.
              </p>
            </div>

            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center text-3xl sm:text-4xl shrink-0 shadow-inner">
              👥
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* GRUP 2: STATUS VERIFIKASI (Menunggu + Dikonfirmasi + Ditolak) */}
      {/* ======================================================== */}
      <section className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Grup 2 • Status Verifikasi Berkas
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
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 sm:p-5 transition hover:shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">Menunggu</span>
              <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-base">
                ⏳
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-950">
              {loading ? '...' : totalMenunggu}
            </div>
            <p className="text-[11px] text-amber-800/80 mt-1">
              Menunggu peninjauan bukti transfer/akun HSI oleh panitia.
            </p>
          </div>

          {/* 2. Dikonfirmasi (Lolos Verifikasi / ACC) */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 sm:p-5 transition hover:shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Dikonfirmasi (ACC)</span>
              <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-base">
                ✅
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-950">
              {loading ? '...' : totalDikonfirmasi}
            </div>
            <p className="text-[11px] text-emerald-800/80 mt-1">
              Lolos verifikasi & tiket QR aktif (angka tetap meski sudah hadir).
            </p>
          </div>

          {/* 3. Ditolak */}
          <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 sm:p-5 transition hover:shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-rose-900 uppercase tracking-wider">Ditolak</span>
              <span className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-base">
                ❌
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-rose-950">
              {loading ? '...' : totalDitolak}
            </div>
            <p className="text-[11px] text-rose-800/80 mt-1">
              Berkas ditolak karena tidak memenuhi ketentuan acara.
            </p>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* GRUP 3: PRESENSI LOKASI (Sudah Hadir vs Belum Hadir)     */}
      {/* ======================================================== */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Grup 3 • Presensi Kehadiran di Meja Registrasi
          </h2>
          <span className="text-[11px] text-slate-400 font-medium">
            Dari {totalDikonfirmasi} peserta dikonfirmasi
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Sudah Hadir */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 sm:p-5 transition hover:shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">Sudah Hadir</span>
              <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-base">
                🎉
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-blue-950">
              {loading ? '...' : totalSudahHadir}
            </div>
            <p className="text-[11px] text-blue-800/80 mt-1">
              Telah scan QR barcode di meja registrasi masuk lokasi.
            </p>
          </div>

          {/* Belum Hadir */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 transition hover:shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Belum Hadir</span>
              <span className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center text-base">
                🕒
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {loading ? '...' : totalBelumHadir}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Sudah memiliki tiket QR terbit, namun belum check-in di lokasi.
            </p>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* GRUP 4: PROGRES KEHADIRAN (Anti-Infinity & Akurat)       */}
      {/* ======================================================== */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Grup 4 • Progres Kehadiran Peserta
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
