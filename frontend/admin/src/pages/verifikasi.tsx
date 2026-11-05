import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface Pendaftar {
  id: string;
  nama: string;
  email: string;
  no_whatsapp: string;
  instansi: string;
  nip?: string;
  jenis_kelamin?: string;
  domisili?: string;
  alasan?: string;
  screenshot_url: string;
  qr_code_url: string;
  qr_token: string;
  status: 'menunggu' | 'dikonfirmasi' | 'ditolak' | 'hadir';
  alasan_tolak?: string;
  wa_terkirim: number;
  created_at: string;
  confirmed_at?: string;
  attended_at?: string;
}

function getNIP(p: Pendaftar): string {
  if (p.nip && p.nip.trim()) return p.nip.trim();
  if (p.instansi) {
    const match = p.instansi.match(/NIP:\s*([A-Za-z0-9\-\/]+)/i);
    if (match) return match[1].trim();
  }
  return '-';
}

export function Verifikasi() {
  const [pendaftar, setPendaftar] = useState<Pendaftar[]>([]);
  const [filter, setFilter] = useState<string>('semua');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedPendaftar, setSelectedPendaftar] = useState<Pendaftar | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Auto-refresh: Pertama kali mount + polling interval berkala (setiap 5 detik) + saat tab browser difokuskan
  useEffect(() => {
    fetchPendaftar(false);

    // Polling background setiap 5 detik agar data pendaftar baru atau pembaruan status langsung diperbarui otomatis tanpa tombol manual
    const interval = setInterval(() => {
      fetchPendaftar(true);
    }, 5000);

    // Refresh saat window browser aktif kembali
    const handleFocus = () => fetchPendaftar(true);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const fetchPendaftar = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/pendaftar`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPendaftar(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleKonfirmasi = async (id: string) => {
    setActionLoading(id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/pendaftar/${id}/konfirmasi`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        await fetchPendaftar(true);
        if (selectedPendaftar && selectedPendaftar.id === id) {
          setSelectedPendaftar(null);
        }
        // Opsional: tanyakan apakah ingin langsung buka WA
        if (data.wa_url && confirm(`Peserta berhasil dikonfirmasi! Buka WhatsApp untuk mengirim QR ke peserta sekarang?`)) {
          window.open(data.wa_url, '_blank');
        }
      }
    } catch (err) {
      console.error('Konfirmasi gagal:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleTolak = async (id: string) => {
    const alasan = prompt('Masukkan alasan penolakan berkas:');
    if (alasan === null) return;

    setActionLoading(id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/pendaftar/${id}/tolak`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ alasan }),
      });
      if (res.ok) {
        await fetchPendaftar(true);
        if (selectedPendaftar && selectedPendaftar.id === id) {
          setSelectedPendaftar(null);
        }
      }
    } catch (err) {
      console.error('Tolak gagal:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleHapus = async (id: string, nama: string) => {
    if (!confirm(`Hapus pendaftar "${nama}"? Data yang dihapus tidak dapat dipulihkan.`)) {
      return;
    }

    setActionLoading(id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/pendaftar/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await fetchPendaftar(true);
        if (selectedPendaftar && selectedPendaftar.id === id) {
          setSelectedPendaftar(null);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Gagal menghapus pendaftar');
      }
    } catch (err) {
      console.error('Hapus gagal:', err);
      alert('Terjadi kesalahan saat menghapus data.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleKirimWA = async (p: Pendaftar) => {
    const pesan = `بسم الله
السلام عليكم ورحمة الله وبركاته
 Selamat Datang Bapak/Ibu/Mas/Mbak ${p.nama},

Pendaftaran Anda untuk acara *Muslim Scene Event* telah *BERHASIL DIKONFIRMASI* ✅

Silakan akses & unduh QR code kehadiran Anda melalui tautan berikut:
🔗 https://ms-evenscan-admin.pages.dev/status

(NIP + 4 digit terakhir no WA)

_*Masukkan kode akses pada halaman tersebut untuk melihat & download QR code*_

Mohon simpan dan tunjukkan QR code ini kepada panitia di meja registrasi pada hari acara.

جزاكم الله خيرا
_Panitia Muslim Scene Event_`;

    let waNumber = p.no_whatsapp.replace(/\D/g, '');
    if (waNumber.startsWith('0')) {
      waNumber = '62' + waNumber.substring(1);
    } else if (waNumber.startsWith('8')) {
      waNumber = '62' + waNumber;
    }

    const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(pesan)}`;
    window.open(waUrl, '_blank');

    // Tandai wa_terkirim di backend
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/admin/pendaftar/${p.id}/mark-wa-sent`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setPendaftar((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, wa_terkirim: 1 } : item))
      );
    } catch (err) {
      console.error('Gagal update status wa_terkirim:', err);
    }
  };

  // Bulk action: Kirim WA ke semua yang terkonfirmasi tapi belum terkirim
  const handleKirimSemuaWA = () => {
    const belumKirim = pendaftar.filter((p) => p.status === 'dikonfirmasi' && !p.wa_terkirim);
    if (belumKirim.length === 0) {
      alert('Semua peserta yang terkonfirmasi sudah pernah dikirimkan WA.');
      return;
    }

    if (confirm(`Akan membuka ${belumKirim.length} tab WhatsApp secara berurutan. Lanjutkan?`)) {
      belumKirim.forEach((p, idx) => {
        setTimeout(() => {
          handleKirimWA(p);
        }, idx * 600);
      });
    }
  };

  const filtered = pendaftar.filter((p) => {
    const matchFilter = filter === 'semua' || p.status === filter;
    const nipStr = getNIP(p).toLowerCase();
    const q = search.toLowerCase();
    const matchSearch =
      search === '' ||
      p.nama.toLowerCase().includes(q) ||
      p.no_whatsapp.includes(q) ||
      (p.instansi && p.instansi.toLowerCase().includes(q)) ||
      nipStr.includes(q);
    return matchFilter && matchSearch;
  });

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      menunggu: 'bg-amber-100 text-amber-800 border border-amber-200',
      dikonfirmasi: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
      ditolak: 'bg-rose-100 text-rose-800 border border-rose-200',
      hadir: 'bg-blue-100 text-blue-800 border border-blue-200',
    };
    return styles[status] || 'bg-slate-100 text-slate-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Verifikasi Pendaftar</h1>
          <p className="text-sm text-slate-500">Tinjau tangkapan layar bukti peserta dan konfirmasi kehadiran.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleKirimSemuaWA}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <span>📱</span> Kirim WA Massal
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-wrap gap-1.5 bg-slate-200/60 p-1 rounded-xl">
          {['semua', 'menunggu', 'dikonfirmasi', 'hadir', 'ditolak'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition capitalize cursor-pointer ${
                filter === f
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative min-w-[260px]">
          <input
            type="text"
            placeholder="Cari nama, NIP, WA, instansi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-[#06305d]/20 focus:border-[#06305d] outline-none transition"
          />
        </div>
      </div>

      {/* Main List Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-slate-400 space-y-2">
            <div className="inline-block animate-spin rounded-full h-7 w-7 border-3 border-[#06305d] border-t-transparent"></div>
            <p className="text-xs font-medium">Memuat data pendaftar...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 space-y-1">
            <p className="text-2xl">📋</p>
            <p className="text-sm font-semibold text-slate-700">Tidak ada pendaftar ditemukan</p>
            <p className="text-xs">Coba sesuaikan kata kunci pencarian atau filter status.</p>
          </div>
        ) : (
          <>
            {/* 1. TAMPILAN MOBILE: Compact List Card (Hanya Nama, NIP, Status) */}
            <div className="md:hidden divide-y divide-slate-100">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedPendaftar(p)}
                  className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer group"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900 text-sm truncate group-hover:text-[#06305d] transition">
                      {p.nama}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-400">NIP:</span>
                      <span className="text-slate-700 font-bold tracking-wide">{getNIP(p)}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ${statusBadge(p.status)}`}>
                      {p.status}
                    </span>
                    <svg className="w-4 h-4 text-slate-400 group-hover:text-[#06305d] group-hover:translate-x-0.5 transition shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>

            {/* 2. TAMPILAN DESKTOP: Tabel Lengkap */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-5 py-3.5">Peserta</th>
                    <th className="px-5 py-3.5">NIP</th>
                    <th className="px-5 py-3.5">Kontak WA</th>
                    <th className="px-5 py-3.5">Instansi</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Notifikasi WA</th>
                    <th className="px-5 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-3.5 font-semibold text-slate-900">
                        <div>{p.nama}</div>
                        {p.email && <div className="text-[11px] font-normal text-slate-400">{p.email}</div>}
                      </td>
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-700">
                        {getNIP(p)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 font-mono">{p.no_whatsapp}</td>
                      <td className="px-5 py-3.5 text-slate-600">{p.instansi || '-'}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${statusBadge(p.status)}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {p.status === 'dikonfirmasi' ? (
                          p.wa_terkirim ? (
                            <span className="text-emerald-600 font-semibold text-[11px] flex items-center gap-1">
                              ✓ Terkirim
                            </span>
                          ) : (
                            <span className="text-amber-600 font-semibold text-[11px] flex items-center gap-1">
                              ⏳ Belum
                            </span>
                          )
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedPendaftar(p)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                          >
                            👁️ Detail
                          </button>

                          {p.status === 'menunggu' && (
                            <>
                              <button
                                type="button"
                                disabled={actionLoading === p.id}
                                onClick={() => handleKonfirmasi(p.id)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-[11px] font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                              >
                                {actionLoading === p.id ? '...' : '✓ ACC'}
                              </button>
                              <button
                                type="button"
                                disabled={actionLoading === p.id}
                                onClick={() => handleTolak(p.id)}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[11px] font-semibold transition disabled:opacity-50 cursor-pointer"
                              >
                                ✕ Tolak
                              </button>
                            </>
                          )}

                          {p.status === 'dikonfirmasi' && (
                            <button
                              type="button"
                              onClick={() => handleKirimWA(p)}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow-xs cursor-pointer ${
                                p.wa_terkirim
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              }`}
                            >
                              <span>📱</span>
                              <span>{p.wa_terkirim ? 'Kirim Ulang' : 'Kirim WA'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            title="Hapus Data"
                            disabled={actionLoading === p.id}
                            onClick={() => handleHapus(p.id, p.nama)}
                            className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[11px] font-semibold transition disabled:opacity-50 cursor-pointer"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal Detail & Screenshot Viewer */}
      {selectedPendaftar && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-bold text-slate-900">Detail Peserta & Berkas</h2>
                <p className="text-xs text-slate-400 font-mono">ID: {selectedPendaftar.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPendaftar(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {/* Peserta Info */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Nama Peserta:</span>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">{selectedPendaftar.nama}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">NIP:</span>
                  <p className="font-bold text-[#06305d] font-mono text-sm mt-0.5">{getNIP(selectedPendaftar)}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">WhatsApp:</span>
                  <p className="font-bold text-slate-800 font-mono mt-0.5">{selectedPendaftar.no_whatsapp}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Status:</span>
                  <p className="mt-0.5">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusBadge(selectedPendaftar.status)}`}>
                      {selectedPendaftar.status}
                    </span>
                  </p>
                </div>
                {selectedPendaftar.email && (
                  <div>
                    <span className="text-slate-400 font-medium">Email:</span>
                    <p className="font-semibold text-slate-700 mt-0.5">{selectedPendaftar.email}</p>
                  </div>
                )}
                {selectedPendaftar.instansi && (
                  <div className="col-span-2">
                    <span className="text-slate-400 font-medium">Instansi / Wilayah:</span>
                    <p className="font-semibold text-slate-700 mt-0.5">{selectedPendaftar.instansi}</p>
                  </div>
                )}
                {selectedPendaftar.alasan && (
                  <div className="col-span-2">
                    <span className="text-slate-400 font-medium">Alasan / Motivasi:</span>
                    <p className="text-slate-600 mt-0.5 italic">"{selectedPendaftar.alasan}"</p>
                  </div>
                )}
                {selectedPendaftar.status === 'ditolak' && selectedPendaftar.alasan_tolak && (
                  <div className="col-span-2 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                    <span className="text-rose-700 font-bold">Alasan Penolakan:</span>
                    <p className="text-rose-800 mt-0.5">{selectedPendaftar.alasan_tolak}</p>
                  </div>
                )}
                {selectedPendaftar.status === 'dikonfirmasi' && (
                  <div className="col-span-2 flex items-center justify-between pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500 font-medium">Status Pengiriman WA:</span>
                    {selectedPendaftar.wa_terkirim ? (
                      <span className="text-emerald-600 font-bold">✓ Sudah Terkirim</span>
                    ) : (
                      <span className="text-amber-600 font-bold">⏳ Belum Terkirim</span>
                    )}
                  </div>
                )}
              </div>

              {/* Bukti Screenshot */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700">Foto / Bukti Screenshot Akun HSI:</span>
                  <a
                    href={`${API_URL}${selectedPendaftar.screenshot_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#06305d] hover:underline font-semibold"
                  >
                    Buka Gambar Penuh ↗
                  </a>
                </div>
                <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center p-2 min-h-[200px]">
                  <img
                    src={`${API_URL}${selectedPendaftar.screenshot_url}`}
                    alt="Bukti Screenshot"
                    className="max-h-72 max-w-full rounded-xl object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                      const parent = (e.target as HTMLElement).parentElement;
                      if (parent) {
                        parent.innerHTML = '<p class="text-xs text-slate-400 p-8 text-center">Gambar tidak dapat dimuat atau disimpan secara lokal.</p>';
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
              <button
                type="button"
                disabled={actionLoading === selectedPendaftar.id}
                onClick={() => handleHapus(selectedPendaftar.id, selectedPendaftar.nama)}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>🗑️</span> Hapus Data
              </button>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPendaftar(null)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Tutup
                </button>

                {selectedPendaftar.status === 'menunggu' && (
                  <>
                    <button
                      type="button"
                      disabled={actionLoading === selectedPendaftar.id}
                      onClick={() => handleTolak(selectedPendaftar.id)}
                      className="px-4 py-2 bg-rose-100 text-rose-800 hover:bg-rose-200 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      Tolak
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading === selectedPendaftar.id}
                      onClick={() => handleKonfirmasi(selectedPendaftar.id)}
                      className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1"
                    >
                      <span>✓</span> Setujui (ACC)
                    </button>
                  </>
                )}

                {selectedPendaftar.status === 'dikonfirmasi' && (
                  <button
                    type="button"
                    onClick={() => handleKirimWA(selectedPendaftar)}
                    className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>📱</span> {selectedPendaftar.wa_terkirim ? 'Kirim Ulang WA' : 'Kirim WA'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
