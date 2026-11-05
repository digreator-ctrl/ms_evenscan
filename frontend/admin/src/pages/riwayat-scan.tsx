import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface PesertaHadir {
  id: string;
  nama: string;
  email: string;
  no_whatsapp: string;
  instansi: string;
  status: string;
  qr_token: string;
  attended_at: string;
  created_at: string;
  confirmed_at?: string;
}

export function RiwayatScan() {
  const [data, setData] = useState<PesertaHadir[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name_asc' | 'name_desc'>('newest');
  const [selectedItem, setSelectedItem] = useState<PesertaHadir | null>(null);

  // Ambil data riwayat scan (otomatis diperbarui secara realtime)
  const fetchRiwayat = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/pendaftar?status=hadir`, {
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

    // Polling background setiap 5 detik agar data selalu terupdate otomatis tanpa tombol
    const interval = setInterval(() => {
      fetchRiwayat(true);
    }, 5000);

    // Refresh saat window browser aktif kembali
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
        second: '2-digit',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  // Filter pencarian & pengurutan (Sort) yang selalu realtime
  const sortedAndFilteredData = useMemo(() => {
    const q = search.toLowerCase().trim();
    const result = data.filter((item) => {
      if (!q) return true;
      return (
        item.nama?.toLowerCase().includes(q) ||
        item.no_whatsapp?.includes(q) ||
        item.instansi?.toLowerCase().includes(q) ||
        item.qr_token?.toLowerCase().includes(q)
      );
    });

    return [...result].sort((a, b) => {
      if (sortBy === 'newest') {
        const timeA = a.attended_at ? new Date(a.attended_at).getTime() : 0;
        const timeB = b.attended_at ? new Date(b.attended_at).getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === 'oldest') {
        const timeA = a.attended_at ? new Date(a.attended_at).getTime() : 0;
        const timeB = b.attended_at ? new Date(b.attended_at).getTime() : 0;
        return timeA - timeB;
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

  const totalHadir = data.length;
  const hadirHariIni = data.filter((d) => isToday(d.attended_at)).length;
  const scanTerakhir = data.length > 0 ? formatDateTime(data[0].attended_at) : '-';

  // Export ke file CSV
  const handleExportCSV = () => {
    if (data.length === 0) {
      alert('Tidak ada data riwayat scan untuk diekspor');
      return;
    }

    const headers = ['No', 'ID Pendaftar', 'Nama Lengkap', 'Instansi', 'WhatsApp', 'Waktu Scan', 'Token QR'];
    const rows = sortedAndFilteredData.map((d, index) => [
      index + 1,
      d.id,
      `"${d.nama.replace(/"/g, '""')}"`,
      `"${(d.instansi || '-').replace(/"/g, '""')}"`,
      `'${d.no_whatsapp}`,
      formatDateTime(d.attended_at),
      d.qr_token,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `riwayat-scan-muslimscene-${new Date().toISOString().slice(0, 10)}.csv`);
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
            Live Sync • Meja Presensi Registrasi
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Riwayat Scan Presensi</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar lengkap peserta yang telah hadir dan ter-scan di pintu masuk. Data otomatis diperbarui tanpa perlu refresh manual.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-sm active:scale-95"
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Total Hadir */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Peserta Hadir</p>
            <p className="text-2xl font-black text-slate-800 tracking-tight">{totalHadir}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Tervalidasi di sistem</p>
          </div>
        </div>

        {/* Hadir Hari Ini */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Hadir Hari Ini</p>
            <p className="text-2xl font-black text-sky-700 tracking-tight">{hadirHariIni}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Sesi tanggal sekarang</p>
          </div>
        </div>

        {/* Terakhir di-scan */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Scan Terakhir</p>
            <p className="text-sm font-bold text-slate-800 truncate mt-0.5">{scanTerakhir}</p>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
              {data.length > 0 ? data[0].nama : 'Belum ada scan'}
            </p>
          </div>
        </div>
      </div>

      {/* SEARCH & SORT BAR (SEJAJAR DALAM SATU BARIS) */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-xs flex flex-row items-center gap-2 sm:gap-3">
        {/* Kolom Search (Flex 1) */}
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
            placeholder="Cari nama, WhatsApp, instansi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#06305d]/20 focus:border-[#06305d] transition"
          />
        </div>

        {/* Dropdown Sort (Posisi Sejajar dengan Search) */}
        <div className="shrink-0 relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="appearance-none pl-8 pr-8 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#06305d]/20 transition"
            title="Urutkan Data"
          >
            <option value="newest">Terbaru</option>
            <option value="oldest">Terlama</option>
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
          <p className="text-xs text-slate-500 font-medium">Memuat riwayat kehadiran...</p>
        </div>
      ) : sortedAndFilteredData.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-slate-800 mb-1">
            {search ? 'Tidak Ada Data yang Cocok' : 'Belum Ada Peserta yang Di-Scan Hadir'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
            {search
              ? 'Coba ganti kata kunci pencarian nama atau WhatsApp.'
              : 'Gunakan tombol Fast Action Scan QR untuk memindai tiket peserta di meja registrasi masuk.'}
          </p>
          <Link
            to="/scanner"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#06305d] hover:bg-[#0a4583] text-white text-xs font-bold shadow-md transition active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7V5a2 2 0 0 1 2-2h2m12 0h2a2 2 0 0 1 2 2v2m0 10v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
              <rect x="7" y="7" width="10" height="10" rx="1.5" />
            </svg>
            <span>Buka Scanner QR Sekarang</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* DESKTOP TABLE VIEW (Layar md ke atas) */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Waktu Scan Hadir</th>
                    <th className="py-3 px-4">Nama Peserta</th>
                    <th className="py-3 px-4">Instansi / Komunitas</th>
                    <th className="py-3 px-4">No. WhatsApp</th>
                    <th className="py-3 px-4">Token QR</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {sortedAndFilteredData.map((item, index) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="hover:bg-sky-50/50 cursor-pointer transition duration-150"
                    >
                      <td className="py-3 px-4 text-center text-slate-400 font-mono font-medium">
                        {index + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">
                          {formatDateTime(item.attended_at)}
                        </div>
                        {isToday(item.attended_at) && (
                          <span className="inline-block px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded mt-0.5">
                            Hari Ini
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{item.nama}</div>
                        <div className="text-[11px] text-slate-400">{item.email}</div>
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
                          className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-medium hover:underline"
                        >
                          <span>{item.no_whatsapp}</span>
                          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.299.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.087-.179.182-.077.357.101.174.453.747.971 1.209.667.594 1.23.778 1.403.865.174.087.275.072.376-.044.101-.116.433-.506.549-.68.116-.173.231-.144.39-.087s1.011.477 1.184.564.289.13.332.203c.044.072.044.419-.1.824z" />
                          </svg>
                        </a>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                          {item.qr_token}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                          <span>✓</span> Hadir
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE CARD VIEW (Layar HP di bawah md) */}
          <div className="md:hidden space-y-3">
            {sortedAndFilteredData.map((item, index) => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs active:bg-slate-50 transition"
              >
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm leading-tight">{item.nama}</h4>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold shrink-0">
                    <span>✓</span> Hadir
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 pl-7">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[11px]">Instansi:</span>
                    <span className="font-medium text-slate-700">{item.instansi || '-'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[11px]">Waktu:</span>
                    <span className="font-semibold text-slate-800">{formatDateTime(item.attended_at)}</span>
                    {isToday(item.attended_at) && (
                      <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded">
                        Hari Ini
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
                    <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200">
                      {item.qr_token}
                    </span>

                    <a
                      href={`https://wa.me/${item.no_whatsapp.replace(/^0/, '62')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
                    >
                      <span>Hubungi WA</span>
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL DETAIL PESERTA */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
              <div>
                <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full mb-1">
                  ✓ Presensi Berhasil Dikonfirmasi
                </span>
                <h3 className="text-lg font-black text-slate-900">{selectedItem.nama}</h3>
                <p className="text-xs text-slate-500">{selectedItem.instansi || 'Peserta Umum'}</p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Waktu Scan Presensi:</span>
                  <span className="font-bold text-slate-800">{formatDateTime(selectedItem.attended_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Nomor WhatsApp:</span>
                  <span className="font-semibold text-slate-800">{selectedItem.no_whatsapp}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Email:</span>
                  <span className="font-semibold text-slate-800">{selectedItem.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">QR Token Tiket:</span>
                  <span className="font-mono font-bold text-sky-700">{selectedItem.qr_token}</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-[11px] text-emerald-900">
                Peserta ini telah hadir di lokasi acara dan barcode telah di-scan oleh meja pendaftaran registrasi.
              </div>
            </div>

            <div className="flex gap-2.5 mt-5">
              <a
                href={`https://wa.me/${selectedItem.no_whatsapp.replace(/^0/, '62')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold text-center shadow-xs transition"
              >
                Kirim Pesan WhatsApp
              </a>
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
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
