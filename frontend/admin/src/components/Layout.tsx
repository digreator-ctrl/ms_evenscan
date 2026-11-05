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

  const isActiveDesktop = (path: string) =>
    location.pathname === path
      ? 'bg-white/15 text-white font-bold border border-white/20 shadow-xs'
      : 'text-sky-100/80 hover:bg-white/10 hover:text-white font-medium';

  const handleLogout = () => {
    if (confirm('Apakah Anda yakin ingin keluar dari akun admin?')) {
      localStorage.removeItem('token');
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col md:flex-row antialiased">
      {/* ======================================================== */}
      {/* 1. DESKTOP SIDE NAVIGATION BAR (Layar md ke atas)        */}
      {/* ======================================================== */}
      <aside className="hidden md:flex fixed top-0 left-0 h-full w-64 bg-gradient-to-b from-[#06305d] via-[#08407c] to-[#05264b] text-white shadow-xl z-30 flex-col justify-between border-r border-[#0a4b8f]">
        <div>
          {/* Brand Info */}
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

          {/* Navigation Links - 5 Menu Desktop */}
          <nav className="p-4 space-y-1.5">
            {/* 1. Dashboard */}
            <Link
              to="/"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs transition duration-150 ${isActiveDesktop('/')}`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span>Dashboard</span>
            </Link>

            {/* 2. Scan History */}
            <Link
              to="/riwayat-scan"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs transition duration-150 ${isActiveDesktop('/riwayat-scan')}`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M4 11a9 9 0 0116 0" />
              </svg>
              <span>Scan History</span>
            </Link>

            {/* 3. Fast Action Scan */}
            <Link
              to="/scanner"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs transition duration-150 ${isActiveDesktop('/scanner')}`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7V5a2 2 0 0 1 2-2h2m12 0h2a2 2 0 0 1 2 2v2m0 10v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                <rect x="7" y="7" width="10" height="10" rx="1.5" />
              </svg>
              <span>Fast Action Scan</span>
            </Link>

            {/* 4. Verification */}
            <Link
              to="/verifikasi"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs transition duration-150 ${isActiveDesktop('/verifikasi')}`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Verification</span>
            </Link>

            {/* 5. Settings */}
            <Link
              to="/pengaturan"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs transition duration-150 ${isActiveDesktop('/pengaturan')}`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Settings & RBAC</span>
            </Link>
          </nav>
        </div>

        {/* Footer Info & Logout */}
        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="px-3 py-2 bg-white/5 rounded-xl border border-white/10 text-[10px] text-sky-200">
            <p className="font-semibold text-white">Yayasan Muslim Scene</p>
            <p className="opacity-70 mt-0.5 font-mono">AHU-0008738.AH.01.04</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-200 hover:bg-rose-900/40 hover:text-rose-100 transition duration-150 text-left"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Keluar Akun</span>
          </button>
        </div>
      </aside>

      {/* ======================================================== */}
      {/* 2. MOBILE APP TOP HEADER (Layar di bawah md)             */}
      {/* ======================================================== */}
      <header className="md:hidden sticky top-0 z-30 bg-gradient-to-r from-[#06305d] via-[#08407c] to-[#0a529b] text-white px-4 py-2.5 flex items-center justify-between border-b border-[#0a4b8f] shadow-sm">
        <div className="flex items-center gap-2.5">
          <img src="/logo-white.png" alt="Muslim Scene Logo" className="h-7 w-auto object-contain" />
          <div>
            <div className="inline-block px-1.5 py-0.2 bg-sky-400/20 text-sky-200 font-bold text-[8px] uppercase tracking-wider rounded">
              Muslim Scene
            </div>
            <h1 className="text-xs font-black tracking-tight leading-none text-white mt-0.5">
              EvenScan Admin
            </h1>
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 3. MAIN CONTENT AREA (Lebar Penuh di Layar HP)           */}
      {/* ======================================================== */}
      <main className="ml-0 md:ml-64 flex-1 p-4 sm:p-6 md:p-8 pb-28 md:pb-8 max-w-7xl w-full min-w-0">
        <Outlet />
      </main>

      {/* ======================================================== */}
      {/* 4. CURVED NOTCH BOTTOM DOCK (5 Item Sesuai Desain Foto)  */}
      {/* ======================================================== */}
      <div className="md:hidden fixed bottom-3 inset-x-0 z-40 px-3 pointer-events-none flex justify-center">
        <div className="relative pointer-events-auto w-full max-w-md flex items-end">
          {/* Background Shape dengan Lengkungan Concave Notch di Tengah */}
          <div className="absolute inset-x-0 bottom-0 h-16 flex items-stretch filter drop-shadow-[0_10px_25px_rgba(6,48,93,0.18)]">
            {/* Sayap Kiri */}
            <div className="flex-1 bg-white rounded-l-3xl border-t border-b border-l border-slate-200/90" />

            {/* Notch Lengkung SVG Presisi di Tengah (Lebar 96px, Kedalaman 38px) */}
            <svg
              className="w-[96px] h-16 shrink-0 text-white fill-current block -mx-[1px]"
              viewBox="0 0 96 64"
              fill="currentColor"
            >
              <path d="M 0 0 C 24 0, 24 38, 48 38 C 72 38, 72 0, 96 0 L 96 64 L 0 64 Z" />
              {/* Garis Border Halus di Sepanjang Lengkungan Atas */}
              <path
                d="M 0 0.5 C 24 0.5, 24 38.5, 48 38.5 C 72 38.5, 72 0.5, 96 0.5"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="1.2"
              />
            </svg>

            {/* Sayap Kanan */}
            <div className="flex-1 bg-white rounded-r-3xl border-t border-b border-r border-slate-200/90" />
          </div>

          {/* Navigasi Interaktif 5 Item:
              [1. Dashboard] [2. Riwayat Scan] [3. FAST ACTION SCAN] [4. Verifikasi] [5. Pengaturan]
          */}
          <nav className="relative z-10 w-full h-16 flex items-center justify-between px-1">
            {/* 1. Tab Dashboard */}
            <Link
              to="/"
              className={`flex flex-col items-center justify-center flex-1 py-1 transition duration-150 active:scale-90 ${
                location.pathname === '/' ? 'text-[#06305d]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={location.pathname === '/' ? '2.4' : '1.8'}
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
              <span className="text-[9.5px] font-semibold tracking-tight mt-0.5">Dashboard</span>
              {/* Indikator Dot di Bawah Ikon Aktif */}
              {location.pathname === '/' ? (
                <span className="w-1.5 h-1.5 bg-[#06305d] rounded-full mt-0.5" />
              ) : (
                <span className="w-1.5 h-1.5 mt-0.5 opacity-0" />
              )}
            </Link>

            {/* 2. Tab Riwayat Scan */}
            <Link
              to="/riwayat-scan"
              className={`flex flex-col items-center justify-center flex-1 py-1 transition duration-150 active:scale-90 ${
                location.pathname === '/riwayat-scan' ? 'text-[#06305d]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={location.pathname === '/riwayat-scan' ? '2.4' : '1.8'}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={location.pathname === '/riwayat-scan' ? '2.4' : '1.8'}
                  d="M9 3v2m6-2v2M4 11a9 9 0 0116 0"
                />
              </svg>
              <span className="text-[9.5px] font-semibold tracking-tight mt-0.5">History</span>
              {/* Indikator Dot di Bawah Ikon Aktif */}
              {location.pathname === '/riwayat-scan' ? (
                <span className="w-1.5 h-1.5 bg-[#06305d] rounded-full mt-0.5" />
              ) : (
                <span className="w-1.5 h-1.5 mt-0.5 opacity-0" />
              )}
            </Link>

            {/* 3. Tombol Hero Tengah: Fast Action Scan (Besar & Melayang di Atas Cekungan Notch) */}
            <div className="w-[96px] shrink-0 h-16 relative flex items-center justify-center">
              <Link
                to="/scanner"
                className="group absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center active:scale-95 transition-transform z-20"
                title="Fast Action Scan QR Presensi"
              >
                <div
                  className={`w-[58px] h-[58px] rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-200 border-[3.5px] border-white ${
                    location.pathname === '/scanner'
                      ? 'bg-gradient-to-tr from-[#06305d] via-[#08407c] to-[#0a529b] shadow-[#06305d]/45 ring-4 ring-sky-300/40 scale-105'
                      : 'bg-gradient-to-tr from-[#06305d] to-[#0a529b] shadow-slate-900/30 group-hover:scale-105'
                  }`}
                >
                  <svg
                    className="w-7 h-7"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                    <rect x="7" y="7" width="10" height="10" rx="1.5" />
                    <line x1="7" y1="12" x2="17" y2="12" strokeWidth="2" strokeDasharray="2 1" />
                  </svg>
                </div>
              </Link>

              {/* Indikator Dot di Bawah Lengkungan Tengah saat Scan QR Aktif (Sesuai Referensi State 3) */}
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2">
                {location.pathname === '/scanner' ? (
                  <span className="block w-1.5 h-1.5 bg-[#06305d] rounded-full" />
                ) : (
                  <span className="block w-1.5 h-1.5 opacity-0" />
                )}
              </div>
            </div>

            {/* 4. Tab Verifikasi */}
            <Link
              to="/verifikasi"
              className={`flex flex-col items-center justify-center flex-1 py-1 transition duration-150 active:scale-90 ${
                location.pathname === '/verifikasi' ? 'text-[#06305d]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={location.pathname === '/verifikasi' ? '2.4' : '1.8'}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-[9.5px] font-semibold tracking-tight mt-0.5">Verification</span>
              {/* Indikator Dot di Bawah Ikon Aktif */}
              {location.pathname === '/verifikasi' ? (
                <span className="w-1.5 h-1.5 bg-[#06305d] rounded-full mt-0.5" />
              ) : (
                <span className="w-1.5 h-1.5 mt-0.5 opacity-0" />
              )}
            </Link>

            {/* 5. Tab Settings */}
            <Link
              to="/pengaturan"
              className={`flex flex-col items-center justify-center flex-1 py-1 transition duration-150 active:scale-90 ${
                location.pathname === '/pengaturan' ? 'text-[#06305d]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={location.pathname === '/pengaturan' ? '2.4' : '1.8'}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={location.pathname === '/pengaturan' ? '2.4' : '1.8'}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-[9.5px] font-semibold tracking-tight mt-0.5">Settings</span>
              {/* Indikator Dot di Bawah Ikon Aktif */}
              {location.pathname === '/pengaturan' ? (
                <span className="w-1.5 h-1.5 bg-[#06305d] rounded-full mt-0.5" />
              ) : (
                <span className="w-1.5 h-1.5 mt-0.5 opacity-0" />
              )}
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}
