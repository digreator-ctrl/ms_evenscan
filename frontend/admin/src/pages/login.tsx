import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login gagal');
      }

      localStorage.setItem('token', data.token);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login gagal. Periksa username dan password.');
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 outline-none transition"
              placeholder="Masukkan username"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 outline-none transition"
              placeholder="Masukkan password"
            />
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-xs font-medium flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#07407b] hover:bg-[#095196] active:scale-[0.99] text-white font-bold py-3 rounded-xl transition duration-150 shadow-md shadow-primary-900/10 disabled:opacity-50 text-sm"
          >
            {loading ? 'Memeriksa...' : 'Masuk ke Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}
