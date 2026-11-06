import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

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

// Normalisasi timestamp DATETIME (UTC tanpa zona) agar diinterpretasikan benar sebagai UTC
function toIsoUTC(value: string): string {
  const s = value.trim();
  const hasTz = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(s);
  return hasTz ? s : s.replace(' ', 'T') + 'Z';
}

function getAttendedTime(item: PesertaHadir): number {
  const t = item.attended_at || item.confirmed_at || item.created_at;
  if (!t) return 0;
  const time = new Date(toIsoUTC(t)).getTime();
  return isNaN(time) ? 0 : time;
}

export function RiwayatScan() {
  const navigate = useNavigate();
  const [data, setData] = useState<PesertaHadir[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name_asc' | 'name_desc'>('newest');

  // Ambil data pendaftar (hanya data dengan status 'hadir' yang ditampilkan di riwayat scan)
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
      console.error('Gagal mengambil riwayat scan:', err);
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

  // Format tanggal & jam bahasa Indonesia (WIB) - timestamp DB (UTC) dikonversi ke Asia/Jakarta
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(toIsoUTC(dateStr));
      if (isNaN(d.getTime())) return dateStr;
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  // Filter khusus hanya peserta yang SUDAH DI-SCAN / HADIR + Pengurutan & Pencarian
  const sortedAndFilteredData = useMemo(() => {
    const q = search.toLowerCase().trim();
    const result = data.filter((item) => {
      // Hanya peserta yang sudah hadir (tercatat scan di lokasi)
      if (item.status !== 'hadir') return false;

      // Pencarian
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
        return getAttendedTime(b) - getAttendedTime(a);
      }
      if (sortBy === 'oldest') {
        return getAttendedTime(a) - getAttendedTime(b);
      }
      if (sortBy === 'name_asc') {
        return (a.nama || '').localeCompare(b.nama || '');
      }
      if (sortBy === 'name_desc') {
        return (b.nama || '').localeCompare(a.nama || '');
      }
      return 0;
    });
  }, [data, search, sortBy]);

  // Export ke file CSV (Data peserta yang hadir)
  const handleExportCSV = () => {
    if (sortedAndFilteredData.length === 0) {
      alert('Tidak ada data riwayat scan untuk diekspor');
      return;
    }

    const headers = ['No', 'ID Pendaftar', 'Nama Lengkap', 'NIP', 'Instansi', 'WhatsApp', 'Waktu Scan Hadir', 'Token QR'];
    const rows = sortedAndFilteredData.map((d, index) => {
      return [
        index + 1,
        d.id,
        `"${(d.nama || '').replace(/"/g, '""')}"`,
        `"${getNIP(d)}"`,
        `"${(d.instansi || '-').replace(/"/g, '""')}"`,
        `'${d.no_whatsapp}`,
        formatDateTime(d.attended_at),
        d.qr_token || '-',
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `history-scan-hadir-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header: Tanpa tombol scan tiket qr, hanya judul & ekspor CSV */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-1 border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Live Sync • Riwayat Scan Presensi Realtime
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Riwayat Scan Kehadiran</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Daftar seluruh peserta yang telah hadir dan berhasil di-scan tiket QR di lokasi acara.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-sm active:scale-95 cursor-pointer"
            title="Download CSV Riwayat Scan"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* SEARCH & SORT BAR (Filter tab dihapus, langsung fokus data hadir) */}
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
            <option value="newest">Scan Terbaru</option>
            <option value="oldest">Scan Terlama</option>
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

      {/* List / Table Area */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-8 h-8 border-3 border-[#06305d] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-medium">Memuat data riwayat scan...</p>
        </div>
      ) : sortedAndFilteredData.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-slate-800 mb-1">
            {search ? 'Tidak Ada Peserta yang Cocok' : 'Belum Ada Riwayat Scan'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {search
              ? 'Coba ubah kata kunci pencarian nama, NIP, atau nomor WhatsApp.'
              : 'Peserta yang telah melakukan scan tiket QR di meja registrasi akan otomatis tercatat dan muncul di sini.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 1. MOBILE CARD VIEW (Layar HP di bawah md) */}
          <div className="md:hidden space-y-2.5">
            {sortedAndFilteredData.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/riwayat-scan/${item.id}`)}
                className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs active:bg-slate-50 transition cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-slate-900 text-sm leading-tight truncate">{item.nama}</h4>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      NIP: <span className="font-bold text-slate-700">{getNIP(item)}</span>
                    </p>
                  </div>

                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 bg-blue-100 text-blue-800 border border-blue-200">
                    ✓ Hadir
                  </span>
                </div>

                <div className="flex items-center justify-end text-[11px] text-[#06305d] font-semibold mt-2 border-t border-slate-100 pt-2">
                  <span className="flex items-center gap-1">
                    Lihat Detail <span>→</span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* 2. DESKTOP TABLE VIEW (Layar md ke atas) */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Nama Peserta</th>
                    <th className="py-3 px-4">NIP</th>
                    <th className="py-3 px-4 text-center">Status Kehadiran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {sortedAndFilteredData.map((item, index) => (
                    <tr
                      key={item.id}
                      onClick={() => navigate(`/riwayat-scan/${item.id}`)}
                      className="hover:bg-slate-50/70 cursor-pointer transition duration-150"
                    >
                      <td className="py-3 px-4 text-center text-slate-400 font-mono font-medium">
                        {index + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{item.nama}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {getNIP(item)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          ✓ Hadir
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
