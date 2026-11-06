import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

type NotificationType = 'success' | 'error' | 'warning';

interface NotificationState {
  type: NotificationType;
  title: string;
  message: string;
}

export function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<NotificationState | null>(null);

  // Notifikasi otomatis hilang dengan sendirinya tanpa perlu diklik/diclose
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 3000);
    return () => clearTimeout(timer);
  }, [notification]);

  const showNotification = (type: NotificationType, title: string, message: string) => {
    setNotification({ type, title, message });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !password) {
      showNotification(
        'warning',
        'Formulir Belum Lengkap',
        'Username dan password wajib diisi sebelum masuk ke dashboard.'
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        showNotification(
          'error',
          'Login Gagal',
          data.error || 'Username atau password salah. Periksa kembali data Anda.'
        );
        return;
      }

      localStorage.setItem('token', data.token);
      showNotification(
        'success',
        'Login Berhasil',
        'Selamat datang di Panel Panitia. Mengarahkan ke dashboard...'
      );
      setTimeout(() => navigate('/'), 1500);
    } catch (err: any) {
      showNotification(
        'error',
        'Login Gagal',
        err.message || 'Login gagal. Periksa username dan password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Subtle Grid Background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(226, 232, 240, 0.7) 1px, transparent 1px), linear-gradient(to bottom, rgba(226, 232, 240, 0.7) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      ></div>

      <div className="relative z-10 w-full max-w-md bg-white rounded-3xl shadow-xl shadow-slate-900/5 border border-slate-200/90 p-8 sm:p-10">
        {/* Logo & Brand Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center p-2.5 mx-auto mb-4 shadow-sm">
            <img src="/logo.png" alt="Muslim Scene Logo" className="w-full h-full object-contain" />
          </div>

          <span className="inline-block px-2.5 py-0.5 bg-sky-100 text-[#0369a1] font-bold text-[10px] tracking-wider uppercase rounded-md mb-1.5">
            Muslim Scene
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Panel Panitia</h1>
          <p className="text-xs text-slate-500 mt-1">Masuk untuk memverifikasi pendaftar & absensi acara.</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 outline-none transition"
              placeholder="Masukkan username"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 pr-11 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 outline-none transition"
                placeholder="Masukkan password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                    />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#07407b] hover:bg-[#095196] active:scale-[0.99] text-white font-bold py-3 rounded-xl transition duration-150 shadow-md shadow-primary-900/10 disabled:opacity-50 text-sm"
          >
            {loading ? 'Memeriksa...' : 'Masuk ke Dashboard'}
          </button>
        </form>
      </div>

      {/* Modal/Popup Notifikasi (Otomatis Hilang) */}
      {notification && (
        <div className="fixed top-6 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
          <div
            className={`toast-enter pointer-events-auto w-full max-w-sm rounded-2xl border shadow-xl shadow-slate-900/10 p-4 flex items-start gap-3 backdrop-blur-sm ${
              notification.type === 'success'
                ? 'bg-emerald-50/95 border-emerald-200'
                : notification.type === 'error'
                ? 'bg-rose-50/95 border-rose-200'
                : 'bg-amber-50/95 border-amber-200'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white ${
                notification.type === 'success'
                  ? 'bg-emerald-500'
                  : notification.type === 'error'
                  ? 'bg-rose-500'
                  : 'bg-amber-500'
              }`}
            >
              {notification.type === 'success' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-black ${
                  notification.type === 'success'
                    ? 'text-emerald-900'
                    : notification.type === 'error'
                    ? 'text-rose-900'
                    : 'text-amber-900'
                }`}
              >
                {notification.title}
              </p>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{notification.message}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
