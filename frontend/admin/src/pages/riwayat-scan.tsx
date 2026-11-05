import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface PesertaHadir {
  id: string;
  nama: string;
  email: string;
  no_whatsapp: string;
  instansi: string;
  nip?: string;
  jenis_kelamin?: string;
  domisili?: string;
  alasan?: string;
  screenshot_url?: string;
  status: 'menunggu' | 'dikonfirmasi' | 'ditolak' | 'hadir' | string;
  qr_token?: string;
  qr_code_url?: string;
  alasan_tolak?: string;
  wa_terkirim?: number;
  attended_at?: string;
  confirmed_at?: string;
  created_at: string;
}

function getNIP(item: PesertaHadir): string {
  if (item.nip && item.nip.trim()) return item.nip.trim();
  if (item.instansi) {
    const match = item.instansi.match(/NIP:\s*([A-Za-z0-9\-\/]+)/i);
    if (match) return match[1].trim();
  }
  return '-';
}

function getLatestTime(item: PesertaHadir): number {
  const t = item.attended_at || item.confirmed_at || item.created_at;
  return t ? new Date(t).getTime() : 0;
}

export function RiwayatScan() {
  const [data, setData] = useState<PesertaHadir[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('semua');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name_asc' | 'name_desc'>('newest');
  const [selectedItem, setSelectedItem] = useState<PesertaHadir | null>(null);

  // Ambil data riwayat lengkap (Terintegrasi: Verifikasi & Scan Presensi)
  const fetchRiwayat = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/pendaftar`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data || []);
      }
    } catch (err) {
      console.error('Gagal mengambil riwayat:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Auto-refresh: Pertama kali mount + interval berkala (setiap 5 detik) + saat tab difokuskan
  useEffect(() => {
    fetchRiwayat(false);

    const interval = setInterval(() => {
      fetchRiwayat(true);
    }, 5000);

    const handleFocus = () => fetchRiwayat(true);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Helper cek apakah tanggal adalah hari ini
  const isToday = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  // Format tanggal & jam bahasa Indonesia
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  // Keterangan aksi dan waktu riwayat
  const getActionInfo = (item: PesertaHadir) => {
    if (item.status === 'hadir' && item.attended_at) {
      return {
        label: 'Scan Presensi Hadir',
        time: item.attended_at,
        badgeClass: 'bg-blue-100 text-blue-800 border border-blue-200',
        badgeText: '✓ Hadir (Scan)',
      };
    }
    if (item.status === 'dikonfirmasi') {
      return {
        label: 'Verifikasi Dikonfirmasi',
        time: item.confirmed_at || item.created_at,
        badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
        badgeText: '✓ Terverifikasi',
      };
    }
    if (item.status === 'ditolak') {
      return {
        label: 'Verifikasi Ditolak',
        time: item.created_at,
        badgeClass: 'bg-rose-100 text-rose-800 border border-rose-200',
        badgeText: '✕ Ditolak',
      };
    }
    return {
      label: 'Menunggu Verifikasi',
      time: item.created_at,
      badgeClass: 'bg-amber-100 text-amber-800 border border-amber-200',
      badgeText: '⏳ Menunggu',
    };
  };

  // Filter & Pengurutan
  const sortedAndFilteredData = useMemo(() => {
    const q = search.toLowerCase().trim();
    const result = data.filter((item) => {
      // 1. Filter Status
      if (statusFilter !== 'semua') {
        if (item.status !== statusFilter) return false;
      }

      // 2. Pencarian
      if (!q) return true;
      const nipVal = getNIP(item).toLowerCase();
      return (
        item.nama?.toLowerCase().includes(q) ||
        item.no_whatsapp?.includes(q) ||
        item.instansi?.toLowerCase().includes(q) ||
        item.qr_token?.toLowerCase().includes(q) ||
        nipVal.includes(q)
      );
    });

    return [...result].sort((a, b) => {
      if (sortBy === 'newest') {
        return getLatestTime(b) - getLatestTime(a);
      }
      if (sortBy === 'oldest') {
        return getLatestTime(a) - getLatestTime(b);
      }
      if (sortBy === 'name_asc') {
        return (a.nama || '').localeCompare(b.nama || '');
      }
      if (sortBy === 'name_desc') {
        return (b.nama || '').localeCompare(a.nama || '');
      }
      return 0;
    });
  }, [data, search, sortBy, statusFilter]);

  // Statistik gabungan
  const totalHadir = data.filter((d) => d.status === 'hadir').length;
  const totalDikonfirmasi = data.filter((d) => d.status === 'dikonfirmasi').length;
  const totalDitolak = data.filter((d) => d.status === 'ditolak').length;
  const hadirHariIni = data.filter((d) => d.status === 'hadir' && isToday(d.attended_at)).length;

  // Export ke file CSV
  const handleExportCSV = () => {
    if (sortedAndFilteredData.length === 0) {
      alert('Tidak ada data riwayat untuk diekspor');
      return;
    }

    const headers = ['No', 'ID Pendaftar', 'Nama Lengkap', 'NIP', 'Status', 'Instansi', 'WhatsApp', 'Waktu Aksi Terakhir', 'Token QR', 'Status WA'];
    const rows = sortedAndFilteredData.map((d, index) => {
      const action = getActionInfo(d);
      return [
        index + 1,
        d.id,
        `"${(d.nama || '').replace(/"/g, '""')}"`,
        `"${getNIP(d)}"`,
        d.status,
        `"${(d.instansi || '-').replace(/"/g, '""')}"`,
        `'${d.no_whatsapp}`,
        formatDateTime(action.time),
        d.qr_token || '-',
        d.wa_terkirim ? 'Sudah' : 'Belum',
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `history-muslimscene-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-1 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Sync • Riwayat Aksi & Presensi Realtime
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Riwayat Aktivitas & Presensi</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Semua riwayat pendaftar yang diverifikasi, disetujui, ditolak, dan di-scan presensi hadir.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/scanner"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#06305d] hover:bg-[#0a4583] text-white text-xs font-semibold transition shadow-sm active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7V5a2 2 0 0 1 2-2h2m12 0h2a2 2 0 0 1 2 2v2m0 10v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
            </svg>
            <span>Scan Tiket QR</span>
          </Link>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-sm active:scale-95 cursor-pointer"
            title="Download CSV"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Hadir (Scan) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Scan Hadir</p>
            <p className="text-xl sm:text-2xl font-black text-blue-900 tracking-tight">{totalHadir}</p>
            <p className="text-[10px] text-slate-400">Tervalidasi di pintu</p>
          </div>
        </div>

        {/* Total Terverifikasi (Dikonfirmasi) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Terverifikasi (ACC)</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-800 tracking-tight">{totalDikonfirmasi}</p>
            <p className="text-[10px] text-slate-400">Tiket QR terbit</p>
          </div>
        </div>

        {/* Hadir Hari Ini */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Scan Hari Ini</p>
            <p className="text-xl sm:text-2xl font-black text-sky-700 tracking-tight">{hadirHariIni}</p>
            <p className="text-[10px] text-slate-400">Sesi saat ini</p>
          </div>
        </div>

        {/* Ditolak */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Berkas Ditolak</p>
            <p className="text-xl sm:text-2xl font-black text-rose-700 tracking-tight">{totalDitolak}</p>
            <p className="text-[10px] text-slate-400">Tidak memenuhi syarat</p>
          </div>
        </div>
      </div>

      {/* FILTER TABS, SEARCH, & SORT */}
      <div className="space-y-3">
        {/* Filter Status Tabs */}
        <div className="flex flex-wrap gap-1.5 bg-slate-200/60 p-1 rounded-xl">
          {[
            { key: 'semua', label: 'Semua Riwayat' },
            { key: 'hadir', label: 'Hadir (Scan)' },
            { key: 'dikonfirmasi', label: 'Diverifikasi (ACC)' },
            { key: 'ditolak', label: 'Ditolak' },
            { key: 'menunggu', label: 'Menunggu' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition capitalize cursor-pointer ${
                statusFilter === tab.key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* SEARCH & SORT BAR SEJAJAR */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-xs flex flex-row items-center gap-2 sm:gap-3">
          {/* Kolom Search */}
          <div className="relative flex-1 min-w-0">
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Cari nama, NIP, WhatsApp, token..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#06305d]/20 focus:border-[#06305d] transition"
            />
          </div>

          {/* Dropdown Sort */}
          <div className="shrink-0 relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="appearance-none pl-8 pr-8 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#06305d]/20 transition"
              title="Urutkan Data"
            >
              <option value="newest">Aksi Terbaru</option>
              <option value="oldest">Aksi Terlama</option>
              <option value="name_asc">Nama (A - Z)</option>
              <option value="name_desc">Nama (Z - A)</option>
            </select>
            <svg
              className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            <svg
              className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* List / Table Area */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-8 h-8 border-3 border-[#06305d] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-medium">Memuat data riwayat...</p>
        </div>
      ) : sortedAndFilteredData.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-slate-800 mb-1">
            {search ? 'Tidak Ada Data yang Cocok' : 'Belum Ada Riwayat'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
            {search
              ? 'Coba ubah kata kunci pencarian nama, NIP, atau filter status.'
              : 'Data dari Verifikasi (ACC/Tolak) dan Scan Tiket akan otomatis tercatat dan muncul di sini.'}
          </p>
          <div className="flex justify-center gap-3">
            <Link
              to="/verifikasi"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
            >
              <span>👁️ Buka Verifikasi</span>
            </Link>
            <Link
              to="/scanner"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#06305d] hover:bg-[#0a4583] text-white text-xs font-bold shadow-md transition"
            >
              <span>📷 Buka Scanner QR</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 1. MOBILE CARD VIEW (Layar HP di bawah md) */}
          <div className="md:hidden space-y-2.5">
            {sortedAndFilteredData.map((item, index) => {
              const action = getActionInfo(item);
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs active:bg-slate-50 transition cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2.5 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm leading-tight truncate">{item.nama}</h4>
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-0.5 pl-7">
                        NIP: <span className="font-bold text-slate-700">{getNIP(item)}</span>
                      </p>
                    </div>

                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${action.badgeClass}`}>
                      {action.badgeText}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-600 pl-7 border-t border-slate-100 pt-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">{action.label}:</span>
                      <span className="font-semibold text-slate-800">{formatDateTime(action.time)}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200">
                        {item.qr_token || '-'}
                      </span>

                      <span className="text-[11px] text-[#06305d] font-semibold flex items-center gap-1">
                        Lihat Detail →
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 2. DESKTOP TABLE VIEW (Layar md ke atas) */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Waktu & Jenis Aksi</th>
                    <th className="py-3 px-4">Nama Peserta</th>
                    <th className="py-3 px-4">NIP</th>
                    <th className="py-3 px-4">Instansi</th>
                    <th className="py-3 px-4">No. WhatsApp</th>
                    <th className="py-3 px-4">Token QR</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {sortedAndFilteredData.map((item, index) => {
                    const action = getActionInfo(item);
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className="hover:bg-slate-50/70 cursor-pointer transition duration-150"
                      >
                        <td className="py-3 px-4 text-center text-slate-400 font-mono font-medium">
                          {index + 1}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">
                            {formatDateTime(action.time)}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                            {action.label}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{item.nama}</div>
                          {item.email && <div className="text-[11px] text-slate-400">{item.email}</div>}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-700">
                          {getNIP(item)}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {item.instansi || <span className="text-slate-300 italic">-</span>}
                        </td>
                        <td className="py-3 px-4">
                          <a
                            href={`https://wa.me/${item.no_whatsapp.replace(/^0/, '62')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-mono hover:underline"
                          >
                            <span>{item.no_whatsapp}</span>
                          </a>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                            {item.qr_token || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${action.badgeClass}`}>
                            {action.badgeText}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedItem(item);
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                          >
                            👁️ Detail
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETAIL PESERTA */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
              <div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold mb-1 ${getActionInfo(selectedItem).badgeClass}`}>
                  {getActionInfo(selectedItem).badgeText}
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900">{selectedItem.nama}</h3>
                <p className="text-xs text-slate-400 font-mono">ID: {selectedItem.id}</p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl">
                <div>
                  <span className="text-slate-400 font-medium">NIP Peserta:</span>
                  <p className="font-bold text-[#06305d] font-mono text-sm mt-0.5">{getNIP(selectedItem)}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">WhatsApp:</span>
                  <p className="font-bold text-slate-800 font-mono mt-0.5">{selectedItem.no_whatsapp}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Email:</span>
                  <p className="font-semibold text-slate-700 mt-0.5">{selectedItem.email || '-'}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Instansi / Asal:</span>
                  <p className="font-semibold text-slate-700 mt-0.5">{selectedItem.instansi || '-'}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Token Tiket QR:</span>
                  <p className="font-mono font-bold text-sky-700 mt-0.5">{selectedItem.qr_token || '-'}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Status WA:</span>
                  <p className="mt-0.5 font-bold">
                    {selectedItem.wa_terkirim ? (
                      <span className="text-emerald-600">✓ Sudah Dikirim</span>
                    ) : (
                      <span className="text-amber-600">⏳ Belum Dikirim</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Timeline Waktu Aksi */}
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Riwayat Waktu:</p>
                <div className="flex justify-between items-center text-slate-600">
                  <span>1. Waktu Pendaftaran:</span>
                  <span className="font-semibold">{formatDateTime(selectedItem.created_at)}</span>
                </div>
                {selectedItem.confirmed_at && (
                  <div className="flex justify-between items-center text-emerald-800">
                    <span>2. Waktu Verifikasi (ACC):</span>
                    <span className="font-bold">{formatDateTime(selectedItem.confirmed_at)}</span>
                  </div>
                )}
                {selectedItem.attended_at && (
                  <div className="flex justify-between items-center text-blue-800">
                    <span>3. Waktu Scan Hadir di Lokasi:</span>
                    <span className="font-bold">{formatDateTime(selectedItem.attended_at)}</span>
                  </div>
                )}
                {selectedItem.status === 'ditolak' && selectedItem.alasan_tolak && (
                  <div className="p-2 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 mt-2">
                    <span className="font-bold">Alasan Penolakan:</span> {selectedItem.alasan_tolak}
                  </div>
                )}
              </div>

              {/* Foto Bukti Screenshot HSI jika ada */}
              {selectedItem.screenshot_url && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700">Bukti Screenshot Akun HSI:</span>
                    <a
                      href={`${API_URL}${selectedItem.screenshot_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-[#06305d] hover:underline font-semibold"
                    >
                      Buka Gambar Penuh ↗
                    </a>
                  </div>
                  <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center p-2 min-h-[160px]">
                    <img
                      src={`${API_URL}${selectedItem.screenshot_url}`}
                      alt="Bukti Screenshot"
                      className="max-h-56 max-w-full rounded-xl object-contain"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2.5 shrink-0">
              <a
                href={`https://wa.me/${selectedItem.no_whatsapp.replace(/^0/, '62')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold text-center shadow-xs transition flex items-center justify-center gap-1.5"
              >
                <span>📱</span> Hubungi via WhatsApp
              </a>
              <button
                onClick={() => setSelectedItem(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
