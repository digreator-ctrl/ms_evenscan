import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface PesertaDetail {
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
  status: string;
  qr_token?: string;
  qr_code_url?: string;
  alasan_tolak?: string;
  wa_terkirim?: number;
  attended_at?: string;
  confirmed_at?: string;
  created_at: string;
}

function getNIP(item: PesertaDetail): string {
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

function formatDateTime(dateStr?: string): string {
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
}

export function RiwayatDetail() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<PesertaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/admin/pendaftar/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || 'Data peserta tidak ditemukan.');
        } else {
          setItem(json.data);
        }
      } catch (err: any) {
        setError('Gagal memuat detail riwayat: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  return (
    <div className="space-y-5">
      {/* Tombol Back ke Halaman History */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          to="/riwayat-scan"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 shadow-xs transition active:scale-95 cursor-pointer"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
          <span>Kembali</span>
          <span className="hidden sm:inline"> ke Riwayat Scan</span>
        </Link>
        <span className="hidden sm:inline text-xs text-slate-400">/</span>
        <span className="hidden sm:inline text-xs font-semibold text-slate-600">Detail Riwayat Peserta</span>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-8 h-8 border-3 border-[#06305d] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-medium">Memuat detail riwayat peserta...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-slate-800 mb-1">Data Tidak Ditemukan</h3>
          <p className="text-xs text-slate-500 mb-4">{error}</p>
          <Link
            to="/riwayat-scan"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#06305d] hover:bg-[#0a4583] text-white text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer"
          >
            Kembali ke Riwayat Scan
          </Link>
        </div>
      ) : item ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden max-w-3xl mx-auto">
          {/* Header Detail */}
          <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold mb-1.5 bg-blue-100 text-blue-800 border border-blue-200">
                ✓ Hadir (Scan)
              </span>
              <h2 className="text-lg sm:text-xl font-black text-slate-900">{item.nama}</h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {item.id}</p>
            </div>
          </div>

          {/* Body Detail */}
          <div className="p-5 sm:p-6 space-y-4 text-xs">
            {/* Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl">
              <div>
                <span className="text-slate-400 font-medium">NIP Peserta:</span>
                <p className="font-bold text-[#06305d] font-mono text-sm mt-0.5">{getNIP(item)}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">WhatsApp:</span>
                <p className="font-bold text-slate-800 font-mono mt-0.5">{item.no_whatsapp}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Email:</span>
                <p className="font-semibold text-slate-700 mt-0.5">{item.email || '-'}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Instansi / Asal:</span>
                <p className="font-semibold text-slate-700 mt-0.5">{item.instansi || '-'}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Token Tiket QR:</span>
                <p className="font-mono font-bold text-sky-700 mt-0.5">{item.qr_token || '-'}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Waktu Scan Hadir:</span>
                <p className="font-semibold text-blue-700 mt-0.5">{formatDateTime(item.attended_at)}</p>
              </div>
            </div>

            {/* Timeline Waktu Aksi */}
            <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
              <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Riwayat Waktu Kehadiran:</p>
              <div className="flex justify-between items-center text-slate-600">
                <span>1. Waktu Pendaftaran:</span>
                <span className="font-semibold">{formatDateTime(item.created_at)}</span>
              </div>
              {item.confirmed_at && (
                <div className="flex justify-between items-center text-emerald-800">
                  <span>2. Waktu Verifikasi (ACC):</span>
                  <span className="font-bold">{formatDateTime(item.confirmed_at)}</span>
                </div>
              )}
              {item.attended_at && (
                <div className="flex justify-between items-center text-blue-800">
                  <span>3. Waktu Scan Hadir di Lokasi:</span>
                  <span className="font-bold">{formatDateTime(item.attended_at)}</span>
                </div>
              )}
            </div>

            {/* Foto Bukti Screenshot HSI jika ada */}
            {item.screenshot_url && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700">Bukti Screenshot Akun HSI:</span>
                  <a
                    href={`${API_URL}${item.screenshot_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#06305d] hover:underline font-semibold"
                  >
                    Buka Gambar Penuh ↗
                  </a>
                </div>
                <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center p-2 min-h-[160px]">
                  <img
                    src={`${API_URL}${item.screenshot_url}`}
                    alt="Bukti Screenshot"
                    className="max-h-56 max-w-full rounded-xl object-contain"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex gap-2.5">
            <a
              href={`https://wa.me/${item.no_whatsapp.replace(/^0/, '62')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold text-center shadow-xs transition flex items-center justify-center gap-1.5"
            >
              <span>📱</span> Hubungi via WhatsApp
            </a>
            <Link
              to="/riwayat-scan"
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer inline-flex items-center justify-center"
            >
              Kembali
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
