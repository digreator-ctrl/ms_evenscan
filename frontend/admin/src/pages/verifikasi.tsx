import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

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

function formatTanggal(isoString?: string): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function Verifikasi() {
  const [searchParams, setSearchParams] = useSearchParams();
  const detailId = searchParams.get('id');

  const [pendaftar, setPendaftar] = useState<Pendaftar[]>([]);
  const [filter, setFilter] = useState<string>('semua');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Auto-refresh: mount + polling interval berkala (setiap 5 detik) + saat tab browser difokuskan
  useEffect(() => {
    fetchPendaftar(false);

    const interval = setInterval(() => {
      fetchPendaftar(true);
    }, 5000);

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
        if (data.wa_url && confirm('Peserta berhasil dikonfirmasi! Buka WhatsApp untuk mengirim QR ke peserta sekarang?')) {
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
        // Kembali ke halaman daftar verifikasi
        setSearchParams({});
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
    const nipVal = getNIP(p) !== '-' ? getNIP(p) : '';
    const nipUpper = nipVal.toUpperCase();
    const isIkhwan =
      p.jenis_kelamin?.toLowerCase() === 'ikhwan' ||
      nipUpper.startsWith('ARN') ||
      (p.instansi || '').toLowerCase().includes('ikhwan');
    const isAkhwat =
      p.jenis_kelamin?.toLowerCase() === 'akhwat' ||
      nipUpper.startsWith('ART') ||
      (p.instansi || '').toLowerCase().includes('akhwat');
    const sapaan = isIkhwan ? 'Bapak/Mas' : isAkhwat ? 'Ibu/Mbak' : 'Bapak/Ibu/Mas/Mbak';

    const cleanWa = p.no_whatsapp.replace(/\D/g, '');
    const wa4 = cleanWa.slice(-4);
    const kodeAkses = `${nipVal}${wa4}`;

    const pesan = `بسم الله
السلام عليكم ورحمة الله وبركاته
 Selamat Datang ${sapaan} ${p.nama},

Pendaftaran Anda untuk acara *Muslim Scene Event* telah *BERHASIL DIKONFIRMASI* ✅

Silakan akses & unduh QR code kehadiran Anda melalui tautan berikut:
🔗 https://ms-evenscan-peserta.pages.dev/status

*${kodeAkses}*

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

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      menunggu: 'bg-amber-100 text-amber-800 border border-amber-200',
      dikonfirmasi: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
      ditolak: 'bg-rose-100 text-rose-800 border border-rose-200',
      hadir: 'bg-blue-100 text-blue-800 border border-blue-200',
    };
    return styles[status] || 'bg-slate-100 text-slate-800 border border-slate-200';
  };

  const selectedPendaftar = pendaftar.find((p) => p.id === detailId) || null;

  // =========================================================================
  // VIEW: HALAMAN PENUH DETAIL PESERTA & BERKAS
  // =========================================================================
  if (detailId) {
    if (loading && pendaftar.length === 0) {
      return (
        <div className="py-24 text-center text-slate-400 space-y-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-[#06305d] border-t-transparent"></div>
          <p className="text-xs font-semibold text-slate-600">Memuat detail pendaftar...</p>
        </div>
      );
    }

    if (!selectedPendaftar) {
      return (
        <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4 max-w-lg mx-auto my-12 shadow-sm">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center text-2xl mx-auto">
            ⚠️
          </div>
          <h2 className="text-lg font-black text-slate-900">Data Pendaftar Tidak Ditemukan</h2>
          <p className="text-xs text-slate-500">
            Pendaftar dengan ID{' '}
            <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{detailId}</code> tidak
            ditemukan atau telah dihapus dari sistem.
          </p>
          <div>
            <button
              type="button"
              onClick={() => setSearchParams({})}
              className="px-4 py-2.5 bg-[#06305d] hover:bg-[#0a4583] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>←</span>
              <span>Kembali ke Halaman Verifikasi</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-in fade-in duration-150">
        {/* HEADER HALAMAN DETAIL: Back button, Judul & Status, dan Button Hapus Data sejajar */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Bagian Kiri: Tombol Back + Teks Detail Peserta & Berkas */}
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className="p-2 sm:px-3 sm:py-2.5 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
                title="Kembali ke Halaman Verifikasi"
              >
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="hidden sm:inline">Kembali</span>
              </button>

              <div className="min-w-0">
                <div className="flex items-center flex-wrap gap-2">
                  <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight truncate">
                    Detail Peserta & Berkas
                  </h1>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold uppercase ${statusBadge(
                      selectedPendaftar.status
                    )}`}
                  >
                    {selectedPendaftar.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                  ID: {selectedPendaftar.id} • Terdaftar: {formatTanggal(selectedPendaftar.created_at)}
                </p>
              </div>
            </div>

            {/* Bagian Kanan: Button Hapus Data Sejajar dengan Teks Detail */}
            <div className="flex items-center justify-end shrink-0">
              <button
                type="button"
                disabled={actionLoading === selectedPendaftar.id}
                onClick={() => handleHapus(selectedPendaftar.id, selectedPendaftar.nama)}
                className="w-full sm:w-auto px-4 py-2.5 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                title="Hapus data peserta ini secara permanen"
              >
                <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                <span>Hapus Data</span>
              </button>
            </div>
          </div>
        </div>

        {/* GRID UTAMA: 2 Kolom Penuh (Data Peserta & Viewer Berkas) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* KOLOM KIRI: Informasi Data Diri Peserta & Kontrol Aksi (lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Card Informasi Profil Peserta */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#06305d]"></span>
                  <span>Informasi Formulir Pendaftaran</span>
                </h2>
                <span className="text-[11px] font-mono text-slate-400">HSI EvenScan</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                  <span className="text-slate-400 font-semibold block text-[11px]">Nama Lengkap</span>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedPendaftar.nama}</p>
                </div>

                <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                  <span className="text-slate-400 font-semibold block text-[11px]">Nomor Induk Peserta (NIP)</span>
                  <p className="font-mono font-bold text-[#06305d] text-sm mt-0.5">{getNIP(selectedPendaftar)}</p>
                </div>

                <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                  <span className="text-slate-400 font-semibold block text-[11px]">Nomor WhatsApp</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="font-mono font-bold text-slate-800 text-sm">{selectedPendaftar.no_whatsapp}</p>
                    <a
                      href={`https://wa.me/${selectedPendaftar.no_whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold hover:underline"
                    >
                      Buka Chat ↗
                    </a>
                  </div>
                </div>

                <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                  <span className="text-slate-400 font-semibold block text-[11px]">Alamat Email</span>
                  <p className="font-semibold text-slate-700 text-xs mt-0.5 truncate">
                    {selectedPendaftar.email || '-'}
                  </p>
                </div>

                {selectedPendaftar.jenis_kelamin && (
                  <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                    <span className="text-slate-400 font-semibold block text-[11px]">Jenis Kelamin</span>
                    <p className="font-bold text-slate-800 capitalize mt-0.5">
                      {selectedPendaftar.jenis_kelamin}
                    </p>
                  </div>
                )}

                {selectedPendaftar.domisili && (
                  <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                    <span className="text-slate-400 font-semibold block text-[11px]">Domisili</span>
                    <p className="font-bold text-slate-800 mt-0.5">{selectedPendaftar.domisili}</p>
                  </div>
                )}

                {selectedPendaftar.instansi && (
                  <div className="sm:col-span-2 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                    <span className="text-slate-400 font-semibold block text-[11px]">Instansi / Wilayah Asal</span>
                    <p className="font-bold text-slate-800 mt-0.5">{selectedPendaftar.instansi}</p>
                  </div>
                )}

                {selectedPendaftar.alasan && (
                  <div className="sm:col-span-2 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                    <span className="text-slate-400 font-semibold block text-[11px]">Alasan / Motivasi Kehadiran</span>
                    <p className="text-slate-700 mt-1 italic leading-relaxed">
                      "{selectedPendaftar.alasan}"
                    </p>
                  </div>
                )}

                <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                  <span className="text-slate-400 font-semibold block text-[11px]">Waktu Pendaftaran</span>
                  <p className="font-medium text-slate-700 mt-0.5">{formatTanggal(selectedPendaftar.created_at)}</p>
                </div>

                <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                  <span className="text-slate-400 font-semibold block text-[11px]">Waktu Verifikasi (ACC)</span>
                  <p className="font-medium text-slate-700 mt-0.5">{formatTanggal(selectedPendaftar.confirmed_at)}</p>
                </div>
              </div>
            </div>

            {/* Card Status & Feedback Panitia */}
            {selectedPendaftar.status === 'ditolak' && selectedPendaftar.alasan_tolak && (
              <div className="bg-rose-50/90 border border-rose-200 p-4 sm:p-5 rounded-2xl sm:rounded-3xl">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-xs mb-1">
                  <span>⚠️</span>
                  <span>Alasan Penolakan Berkas:</span>
                </div>
                <p className="text-xs text-rose-700 leading-relaxed font-medium">{selectedPendaftar.alasan_tolak}</p>
              </div>
            )}

            {selectedPendaftar.status === 'dikonfirmasi' && (
              <div className="bg-emerald-50/90 border border-emerald-200 p-4 sm:p-5 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-emerald-800 font-bold block">Status Notifikasi WhatsApp:</span>
                  <p className="text-emerald-700 mt-0.5 font-medium">
                    {selectedPendaftar.wa_terkirim
                      ? '✓ Pesan tiket dan petunjuk kehadiran telah dikirim ke WhatsApp peserta.'
                      : '⏳ Belum dikirimkan. Silakan klik tombol Kirim WA di bawah.'}
                  </p>
                </div>
                <div className="shrink-0">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold ${
                      selectedPendaftar.wa_terkirim
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {selectedPendaftar.wa_terkirim ? 'Sudah Terkirim' : 'Belum Terkirim'}
                  </span>
                </div>
              </div>
            )}

            {selectedPendaftar.status === 'hadir' && (
              <div className="bg-blue-50/90 border border-blue-200 p-4 sm:p-5 rounded-2xl sm:rounded-3xl text-xs">
                <span className="text-blue-900 font-bold flex items-center gap-1.5">
                  <span>🎉</span>
                  <span>Peserta Telah Hadir di Lokasi</span>
                </span>
                <p className="text-blue-700 mt-0.5">
                  Presensi terverifikasi pada: {formatTanggal(selectedPendaftar.attended_at)}
                </p>
              </div>
            )}

            {/* Card Aksi Panitia */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                <span>Tindakan Verifikasi Panitia</span>
              </h2>

              <div className="flex flex-wrap items-center gap-3">
                {selectedPendaftar.status === 'menunggu' && (
                  <>
                    <button
                      type="button"
                      disabled={actionLoading === selectedPendaftar.id}
                      onClick={() => handleKonfirmasi(selectedPendaftar.id)}
                      className="flex-1 min-w-[160px] px-5 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{actionLoading === selectedPendaftar.id ? 'Memproses...' : 'Setujui Berkas (ACC)'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={actionLoading === selectedPendaftar.id}
                      onClick={() => handleTolak(selectedPendaftar.id)}
                      className="px-5 py-3 bg-rose-50 hover:bg-rose-100 active:scale-98 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Tolak Berkas</span>
                    </button>
                  </>
                )}

                {selectedPendaftar.status === 'dikonfirmasi' && (
                  <button
                    type="button"
                    onClick={() => handleKirimWA(selectedPendaftar)}
                    className="flex-1 min-w-[200px] px-5 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>📱</span>
                    <span>{selectedPendaftar.wa_terkirim ? 'Kirim Ulang Tiket WhatsApp' : 'Kirim Tiket WhatsApp'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSearchParams({})}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Kembali ke Daftar
                </button>
              </div>
            </div>
          </div>

          {/* KOLOM KANAN: Viewer Berkas Screenshot & Tiket QR (lg:col-span-5) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Card Viewer Bukti Screenshot Akun HSI */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-black text-slate-900">Bukti Screenshot Akun HSI</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">Verifikasi kecocokan NIP & nama peserta</p>
                </div>
                <a
                  href={`${API_URL}${selectedPendaftar.screenshot_url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-[#06305d] border border-slate-200 rounded-lg text-[11px] font-bold transition inline-flex items-center gap-1 shadow-2xs"
                >
                  <span>Buka Penuh</span>
                  <span>↗</span>
                </a>
              </div>

              {/* Kontainer Gambar Penuh & Responsive */}
              <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center p-2 min-h-[320px] max-h-[580px]">
                <img
                  src={`${API_URL}${selectedPendaftar.screenshot_url}`}
                  alt="Bukti Screenshot HSI"
                  className="max-h-[540px] max-w-full rounded-xl object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                    const parent = (e.target as HTMLElement).parentElement;
                    if (parent) {
                      parent.innerHTML =
                        '<p class="text-xs text-slate-400 p-8 text-center leading-relaxed">Gambar berkas screenshot tidak dapat dimuat atau disimpan secara lokal.</p>';
                    }
                  }}
                />
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed italic bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                💡 Periksa tangkapan layar di atas dengan saksama untuk memastikan keaslian akun HSI peserta.
              </p>
            </div>

            {/* Card Tiket QR Peserta (Jika sudah ACC atau Hadir) */}
            {(selectedPendaftar.status === 'dikonfirmasi' || selectedPendaftar.status === 'hadir') &&
              selectedPendaftar.qr_token && (
                <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4 text-center">
                  <div className="border-b border-slate-100 pb-3 text-left">
                    <h2 className="text-sm font-black text-slate-900">QR Code Tiket Peserta</h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">Tiket presensi resmi yang diterbitkan</p>
                  </div>

                  <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <img
                      src={`${API_URL}/api/peserta/qr/${selectedPendaftar.qr_token}`}
                      alt="QR Code Tiket"
                      className="w-44 h-44 object-contain rounded-xl bg-white p-2 shadow-xs border border-slate-200"
                    />
                    <div className="mt-3">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Token QR
                      </span>
                      <span className="font-mono text-xs font-black text-[#06305d] tracking-wide">
                        {selectedPendaftar.qr_token}
                      </span>
                    </div>
                  </div>

                  <a
                    href={`${API_URL}/api/peserta/qr/${selectedPendaftar.qr_token}`}
                    download={`QR_EvenScan_${selectedPendaftar.nama.replace(/\s+/g, '_')}.png`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                  >
                    <span>💾</span>
                    <span>Unduh Gambar QR Code</span>
                  </a>
                </div>
              )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: DAFTAR VERIFIKASI PENDAFTAR (LIST & TABEL)
  // =========================================================================
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Verifikasi Pendaftar</h1>
        <p className="text-sm text-slate-500">Tinjau tangkapan layar bukti peserta dan konfirmasi kehadiran.</p>
      </div>

      {/* SEARCH & FILTER BAR SEJAJAR */}
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
            placeholder="Cari nama, NIP, WA, instansi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#06305d]/20 focus:border-[#06305d] transition"
          />
        </div>

        {/* Button Dropdown Filter Status */}
        <div className="shrink-0 relative">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="appearance-none pl-8 pr-8 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#06305d]/20 transition"
            title="Filter Status Pendaftar"
          >
            <option value="semua">Semua Status ({pendaftar.length})</option>
            <option value="menunggu">Menunggu ({pendaftar.filter((p) => p.status === 'menunggu').length})</option>
            <option value="dikonfirmasi">Dikonfirmasi ({pendaftar.filter((p) => p.status === 'dikonfirmasi').length})</option>
            <option value="hadir">Hadir ({pendaftar.filter((p) => p.status === 'hadir').length})</option>
            <option value="ditolak">Ditolak ({pendaftar.filter((p) => p.status === 'ditolak').length})</option>
          </select>
          <svg
            className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
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
            {/* 1. TAMPILAN MOBILE: Compact List Card (Hanya Nama, NIP, Status) -> Klik membuka halaman detail */}
            <div className="md:hidden divide-y divide-slate-100">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSearchParams({ id: p.id })}
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
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ${statusBadge(
                        p.status
                      )}`}
                    >
                      {p.status}
                    </span>
                    <svg
                      className="w-4 h-4 text-slate-400 group-hover:text-[#06305d] group-hover:translate-x-0.5 transition shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
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
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-700">{getNIP(p)}</td>
                      <td className="px-5 py-3.5 text-slate-600 font-mono">{p.no_whatsapp}</td>
                      <td className="px-5 py-3.5 text-slate-600">{p.instansi || '-'}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${statusBadge(
                            p.status
                          )}`}
                        >
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
                            onClick={() => setSearchParams({ id: p.id })}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1"
                          >
                            <span>👁️</span>
                            <span>Detail</span>
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
    </div>
  );
}
