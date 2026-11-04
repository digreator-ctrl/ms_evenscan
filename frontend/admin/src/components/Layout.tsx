import { useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  // Proteksi rute admin
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  const isActive = (path: string) =>
    location.pathname === path
      ? 'bg-white/15 text-white font-bold border border-white/20 shadow-xs'
      : 'text-sky-100/80 hover:bg-white/10 hover:text-white font-medium';

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* Sidebar Ocean Navy Muslim Scene */}
      <aside className="fixed top-0 left-0 h-full w-64 bg-gradient-to-b from-[#06305d] via-[#08407c] to-[#05264b] text-white shadow-xl z-20 flex flex-col justify-between border-r border-[#0a4b8f]">
        <div>
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <img src="/logo-white.png" alt="Muslim Scene Logo" className="h-9 w-auto object-contain" />
              <div>
                <div className="inline-block px-1.5 py-0.5 bg-sky-400/20 text-sky-200 font-bold text-[9px] uppercase tracking-wider rounded">
                  Muslim Scene
                </div>
                <h1 className="text-sm font-black tracking-tight leading-tight text-white mt-0.5">
                  EvenScan Admin
                </h1>
              </div>
            </div>
          </div>

          <nav className="p-4 space-y-1.5">
            <Link to="/" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs transition ${isActive('/')}`}>
              <span className="text-base">📊</span>
              <span>Dashboard Ringkasan</span>
            </Link>
            <Link to="/verifikasi" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs transition ${isActive('/verifikasi')}`}>
              <span className="text-base">✅</span>
              <span>Verifikasi Pendaftar</span>
            </Link>
            <Link to="/scanner" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs transition ${isActive('/scanner')}`}>
              <span className="text-base">📷</span>
              <span>Scanner QR Presensi</span>
            </Link>
          </nav>
        </div>

        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="px-3 py-2 bg-white/5 rounded-xl border border-white/10 text-[10px] text-sky-200">
            <p className="font-semibold text-white">Yayasan Muslim Scene</p>
            <p className="opacity-70 mt-0.5">AHU-0008738.AH.01.04</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-200 hover:bg-rose-900/40 hover:text-rose-100 transition text-left"
          >
            <span>🚪</span>
            <span>Keluar Akun</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="ml-64 flex-1 p-8 max-w-7xl">
        <Outlet />
      </main>
    </div>
  );
}
