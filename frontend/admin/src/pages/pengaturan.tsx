import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface AdminUser {
  id: string;
  username: string;
  nama: string;
  role: 'superadmin' | 'panitia' | 'scanner';
  created_at?: string;
}

export function Pengaturan() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentSub = searchParams.get('sub'); // 'profil' | 'rbac' | 'acara' | 'sistem' | null

  // State Profil User
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);

  // State Validasi Konfirmasi Keluar (Logout)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // State Manajemen RBAC Pengguna (Superadmin)
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [rbacTab, setRbacTab] = useState<'akses' | 'tambah'>('tambah');
  const [showAddForm, setShowAddForm] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userSort, setUserSort] = useState<'terbaru' | 'terlama' | 'nama_asc' | 'nama_desc' | 'role'>('terbaru');

  // Form Tambah User
  const [newNama, setNewNama] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'superadmin' | 'panitia' | 'scanner'>('panitia');
  const [submittingUser, setSubmittingUser] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'superadmin' && currentSub === 'rbac') {
      fetchUsers();
    }
  }, [currentUser, currentSub]);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await fetch(`${API_URL}/api/admin/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      } else {
        setCurrentUser({
          id: 'admin_master',
          username: 'admin',
          nama: 'Administrator Muslim Scene',
          role: 'superadmin',
        });
      }
    } catch (err) {
      console.error('Gagal fetch profil:', err);
      setCurrentUser({
        id: 'admin_master',
        username: 'admin',
        nama: 'Administrator Muslim Scene',
        role: 'superadmin',
      });
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Gagal fetch users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!newNama || !newUsername || !newPassword) {
      setFormError('Nama lengkap, username, dan password wajib diisi');
      return;
    }

    if (newPassword.length < 6) {
      setFormError('Password minimal 6 karakter');
      return;
    }

    setSubmittingUser(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nama: newNama,
          username: newUsername,
          password: newPassword,
          role: newRole,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setFormError(json.error || 'Gagal menambahkan pengguna');
        return;
      }

      setFormSuccess(`Pengguna "${newNama}" (@${newUsername}) berhasil ditambahkan!`);
      setNewNama('');
      setNewUsername('');
      setNewPassword('');
      setNewRole('panitia');
      setShowAddForm(false);
      await fetchUsers();
    } catch (err: any) {
      setFormError('Terjadi kesalahan jaringan: ' + err.message);
    } finally {
      setSubmittingUser(false);
    }
  };

  const getFilteredAndSortedUsers = () => {
    const allList: AdminUser[] = [
      {
        id: 'admin_master',
        username: 'admin',
        nama: 'Administrator Muslim Scene',
        role: 'superadmin',
        created_at: '2026-01-01T00:00:00Z',
      },
      ...users,
    ];

    const q = userSearch.toLowerCase().trim();
    let filtered = allList.filter((u) => {
      if (!q) return true;
      return (
        u.nama.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });

    filtered.sort((a, b) => {
      if (userSort === 'nama_asc') {
        return a.nama.localeCompare(b.nama);
      }
      if (userSort === 'nama_desc') {
        return b.nama.localeCompare(a.nama);
      }
      if (userSort === 'role') {
        const order: Record<string, number> = { superadmin: 1, panitia: 2, scanner: 3 };
        return (order[a.role] || 99) - (order[b.role] || 99);
      }
      if (userSort === 'terlama') {
        if (a.id === 'admin_master') return -1;
        if (b.id === 'admin_master') return 1;
        return (a.created_at || a.id).localeCompare(b.created_at || b.id);
      }
      // 'terbaru' default
      if (a.id === 'admin_master') return -1;
      if (b.id === 'admin_master') return 1;
      return (b.created_at || b.id).localeCompare(a.created_at || a.id);
    });

    return filtered;
  };

  const handleDeleteUser = async (id: string, nama: string) => {
    if (!confirm(`Yakin ingin menghapus pengguna "${nama}"? Aksi ini tidak dapat dibatalkan.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setUsers(users.filter((u) => u.id !== id));
      } else {
        const json = await res.json();
        alert(json.error || 'Gagal menghapus pengguna');
      }
    } catch (err) {
      alert('Gagal menghapus pengguna');
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const renderLogoutModal = () => {
    if (!showLogoutConfirm) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
        <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-150">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>

          <h3 className="text-base font-black text-slate-900 mb-1.5">Konfirmasi Keluar Akun</h3>
          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            Apakah Anda benar-benar yakin ingin keluar dari akun admin? Anda harus login kembali dengan username & password untuk mengakses sistem ini.
          </p>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(false)}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition active:scale-95"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={confirmLogout}
              className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm active:scale-95"
            >
              Ya, Keluar
            </button>
          </div>
        </div>
      </div>
    );
  };

  const openSubmenu = (sub: string) => {
    setSearchParams({ sub });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const backToMenu = () => {
    setSearchParams({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'superadmin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-black uppercase tracking-wider border border-purple-200">
            ★ Superadmin
          </span>
        );
      case 'panitia':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-black uppercase tracking-wider border border-sky-200">
            ✓ Panitia Registrasi
          </span>
        );
      case 'scanner':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider border border-amber-200">
            ⎚ Petugas Scanner
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[10px] font-bold">
            {role}
          </span>
        );
    }
  };

  // ==========================================================
  // VIEW 1: DETAIL SUBMENU PROFIL ADMIN
  // ==========================================================
  if (currentSub === 'profil') {
    return (
      <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-150">
        {/* Tombol Back */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={backToMenu}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 shadow-xs transition active:scale-95"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
            <span>Kembali</span>
            <span className="hidden sm:inline"> ke Pengaturan</span>
          </button>
          <span className="hidden sm:inline text-xs text-slate-400">/</span>
          <span className="hidden sm:inline text-xs font-semibold text-slate-600">Detail Profil Saya</span>
        </div>

        {/* Kartu Profil Utama */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#06305d] to-[#0a529b] text-white flex items-center justify-center font-black text-2xl shadow-md shrink-0">
              {currentUser?.nama?.charAt(0) || 'A'}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-xl font-black text-slate-900 leading-tight">
                  {currentUser?.nama || 'Administrator'}
                </h2>
                {currentUser && getRoleBadge(currentUser.role)}
              </div>
              <p className="text-xs text-slate-500 font-mono">@{currentUser?.username || 'admin'}</p>
              <p className="text-[11px] text-slate-400 mt-1">ID Pengguna: {currentUser?.id}</p>
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold self-start sm:self-auto">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Sesi JWT Aktif
            </span>
          </div>

          <div className="pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 bg-slate-50 rounded-2xl">
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Hak Akses Role</p>
              <p className="font-bold text-slate-800 mt-0.5 capitalize">{currentUser?.role}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                {currentUser?.role === 'superadmin'
                  ? 'Akses penuh seluruh fitur admin, verifikasi berkas, scanner, dan RBAC.'
                  : currentUser?.role === 'panitia'
                  ? 'Akses verifikasi berkas pendaftar dan scanner presensi.'
                  : 'Akses khusus pemindaian QR code di pintu masuk.'}
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl">
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Keamanan & Autentikasi</p>
              <p className="font-bold text-slate-800 mt-0.5">Enkripsi Web Crypto SHA-256</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Password di-hash dengan standar crypto Cloudflare Workers.
              </p>
            </div>
          </div>

          {/* Rincian Izin Akun */}
          <div className="pt-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              Daftar Wewenang Akun
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Melihat data pendaftar & ringkasan kehadiran</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Menggunakan Fast Action Scan kamera QR code</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Melihat daftar riwayat scan peserta hadir</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                {currentUser?.role === 'superadmin' || currentUser?.role === 'panitia' ? (
                  <>
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>Memverifikasi berkas pembayaran & mengirim tiket WhatsApp</span>
                  </>
                ) : (
                  <>
                    <span className="text-slate-300">✗</span>
                    <span className="text-slate-400">Verifikasi berkas (Khusus Panitia & Superadmin)</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                {currentUser?.role === 'superadmin' ? (
                  <>
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>Menambah & menghapus pengguna panitia lain (RBAC)</span>
                  </>
                ) : (
                  <>
                    <span className="text-slate-300">✗</span>
                    <span className="text-slate-400">Manajemen Pengguna RBAC (Khusus Superadmin)</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Keluar dari Akun Ini</span>
            </button>
          </div>
        </div>

        {renderLogoutModal()}
      </div>
    );
  }

  // ==========================================================
  // VIEW 2: DETAIL SUBMENU MANAJEMEN PENGGUNA (RBAC)
  // ==========================================================
  if (currentSub === 'rbac') {
    const filteredUsers = getFilteredAndSortedUsers();
    const superadminCount = 1 + users.filter((u) => u.role === 'superadmin').length;
    const panitiaCount = users.filter((u) => u.role === 'panitia').length;
    const scannerCount = users.filter((u) => u.role === 'scanner').length;

    return (
      <div className="max-w-4xl mx-auto space-y-5 animate-in fade-in duration-150">
        {/* Tombol Back & Header Ringkas Mobile */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={backToMenu}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 shadow-xs transition active:scale-95"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
              </svg>
              <span>Kembali</span>
              <span className="hidden sm:inline"> ke Pengaturan</span>
            </button>
            <span className="hidden sm:inline text-xs text-slate-400">/</span>
            <span className="hidden sm:inline text-xs font-semibold text-slate-600">Manajemen Pengguna (RBAC)</span>
          </div>
        </div>

        {currentUser?.role !== 'superadmin' ? (
          /* Locked State untuk Non-Superadmin */
          <div className="bg-white rounded-3xl p-8 border border-amber-200 shadow-xs text-center max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-200">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-base font-black text-slate-800 mb-1">Akses Terbatas: Khusus Superadmin</h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Akun Anda memiliki role <strong className="text-slate-800">{currentUser?.role}</strong>. Modul penambahan pengguna dan konfigurasi hak akses (RBAC) hanya dapat dikelola oleh Superadmin.
            </p>
            <button
              onClick={backToMenu}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-sm transition active:scale-95"
            >
              Kembali ke Menu Pengaturan
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Tab Navigasi RBAC: Pengelolaan Akses & Tambah Pengguna */}
            <div className="flex p-1 bg-slate-200/80 rounded-2xl gap-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setRbacTab('akses');
                  setFormError('');
                  setFormSuccess('');
                }}
                className={`flex-1 py-2.5 px-3 rounded-xl transition-all duration-150 flex items-center justify-center gap-2 ${
                  rbacTab === 'akses'
                    ? 'bg-white text-[#06305d] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Pengelolaan Akses</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRbacTab('tambah');
                  setFormError('');
                  setFormSuccess('');
                }}
                className={`flex-1 py-2.5 px-3 rounded-xl transition-all duration-150 flex items-center justify-center gap-2 ${
                  rbacTab === 'tambah'
                    ? 'bg-white text-[#06305d] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                <span>Tambah Pengguna</span>
                <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] text-slate-600 font-mono">
                  {users.length + 1}
                </span>
              </button>
            </div>

            {/* TAB 1: PENGELOLAAN AKSES */}
            {rbacTab === 'akses' ? (
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-6 animate-in fade-in duration-150">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-slate-800">Matriks Hak Akses & Tata Kelola RBAC</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Rincian wewenang operasional untuk setiap tingkatan pengguna pada aplikasi EvenScan.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRbacTab('tambah')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#06305d] hover:bg-[#0a4583] text-white text-xs font-bold transition shadow-xs active:scale-95 self-start sm:self-auto"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Kelola Pengguna di Tab Tambah Pengguna →</span>
                  </button>
                </div>

                {/* Ringkasan Distribusi Akun */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 bg-purple-50/70 border border-purple-200/80 rounded-2xl">
                    <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Superadmin</p>
                    <p className="text-2xl font-black text-purple-900 mt-1">{superadminCount} Akun</p>
                    <p className="text-[11px] text-purple-600 mt-0.5">Akses tertinggi & manajemen RBAC</p>
                  </div>

                  <div className="p-4 bg-sky-50/70 border border-sky-200/80 rounded-2xl">
                    <p className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">Panitia Registrasi</p>
                    <p className="text-2xl font-black text-sky-900 mt-1">{panitiaCount} Akun</p>
                    <p className="text-[11px] text-sky-600 mt-0.5">Verifikasi berkas & scanner tiket</p>
                  </div>

                  <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl">
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Petugas Scanner</p>
                    <p className="text-2xl font-black text-amber-900 mt-1">{scannerCount} Akun</p>
                    <p className="text-[11px] text-amber-600 mt-0.5">Pemindaian QR presensi di gerbang</p>
                  </div>
                </div>

                {/* Tabel Matriks Hak Akses per Fitur */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Matriks Perbandingan Wewenang Fitur
                  </h4>
                  <div className="rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            <th className="py-3 px-4">Fitur / Modul Sistem</th>
                            <th className="py-3 px-4 text-center">Superadmin</th>
                            <th className="py-3 px-4 text-center">Panitia Registrasi</th>
                            <th className="py-3 px-4 text-center">Petugas Scanner</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="py-3 px-4 font-semibold text-slate-800">
                              Dashboard & Statistik Kehadiran
                            </td>
                            <td className="py-3 px-4 text-center text-emerald-600 font-black">✓</td>
                            <td className="py-3 px-4 text-center text-emerald-600 font-black">✓</td>
                            <td className="py-3 px-4 text-center text-slate-300 font-bold">✗</td>
                          </tr>
                          <tr>
                            <td className="py-3 px-4 font-semibold text-slate-800">
                              Verifikasi Berkas & Tiket WhatsApp
                            </td>
                            <td className="py-3 px-4 text-center text-emerald-600 font-black">✓</td>
                            <td className="py-3 px-4 text-center text-emerald-600 font-black">✓</td>
                            <td className="py-3 px-4 text-center text-slate-300 font-bold">✗</td>
                          </tr>
                          <tr>
                            <td className="py-3 px-4 font-semibold text-slate-800">
                              Fast Action Scanner Kamera QR
                            </td>
                            <td className="py-3 px-4 text-center text-emerald-600 font-black">✓</td>
                            <td className="py-3 px-4 text-center text-emerald-600 font-black">✓</td>
                            <td className="py-3 px-4 text-center text-emerald-600 font-black">✓</td>
                          </tr>
                          <tr>
                            <td className="py-3 px-4 font-semibold text-slate-800">
                              Riwayat Scan Peserta (History)
                            </td>
                            <td className="py-3 px-4 text-center text-emerald-600 font-black">✓</td>
                            <td className="py-3 px-4 text-center text-emerald-600 font-black">✓</td>
                            <td className="py-3 px-4 text-center text-emerald-600 font-black">✓</td>
                          </tr>
                          <tr>
                            <td className="py-3 px-4 font-semibold text-slate-800">
                              Manajemen Pengguna & Tambah Akun (RBAC)
                            </td>
                            <td className="py-3 px-4 text-center text-emerald-600 font-black">✓</td>
                            <td className="py-3 px-4 text-center text-slate-300 font-bold">✗</td>
                            <td className="py-3 px-4 text-center text-slate-300 font-bold">✗</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Panduan Deskripsi Role */}
                <div className="space-y-3 pt-1">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Panduan Deskripsi Peran (Role Guide)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                      <p className="font-bold text-purple-900">1. Superadmin</p>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        Koordinator / Tim IT. Akses seluruh modul aplikasi, otorisasi pendaftar, dan wewenang mutlak menambah/menghapus panitia.
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                      <p className="font-bold text-sky-900">2. Panitia Registrasi</p>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        Pemeriksaan bukti transfer, konfirmasi validitas pembayaran, kirim tiket WhatsApp otomatis, dan scan presensi peserta.
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                      <p className="font-bold text-amber-900">3. Petugas Scanner</p>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        Difokuskan untuk gatekeeper di pintu masuk venue guna memindai QR code tiket secara cepat tanpa akses data keuangan.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* TAB 2: TAMBAH PENGGUNA (SEARCH, SORT, BUTTON TAMBAH PENGGUNA, DAN LIST PENGGUNA) */
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Notifikasi Error & Success */}
                {formSuccess && (
                  <div className="p-3.5 bg-emerald-50 text-emerald-800 text-xs rounded-2xl border border-emerald-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="font-semibold">{formSuccess}</span>
                    </div>
                    <button
                      onClick={() => setFormSuccess('')}
                      className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {formError && (
                  <div className="p-3.5 bg-rose-50 text-rose-700 text-xs rounded-2xl border border-rose-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{formError}</span>
                    </div>
                    <button
                      onClick={() => setFormError('')}
                      className="text-rose-700 hover:text-rose-900 text-xs font-bold"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Toolbar RBAC: Search di atas, Sort di sampingnya, dan Button Tambah Pengguna di bawahnya pada mobile (proporsional di desktop) */}
                <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
                  {/* Bagian Atas Mobile / Bagian Kiri Desktop: Search + Sort Berdampingan */}
                  <div className="flex items-center gap-2 flex-1 sm:max-w-md">
                    {/* Menu Search */}
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Cari nama, username..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#06305d]/20 focus:border-[#06305d] transition"
                      />
                      <svg
                        className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                      {userSearch && (
                        <button
                          onClick={() => setUserSearch('')}
                          className="absolute right-2.5 top-2.5 w-4 h-4 rounded-full bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center text-[10px]"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Menu Sort di Samping Search */}
                    <div className="shrink-0">
                      <select
                        value={userSort}
                        onChange={(e) => setUserSort(e.target.value as any)}
                        className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#06305d]/20 focus:border-[#06305d] transition cursor-pointer"
                      >
                        <option value="terbaru">Terbaru</option>
                        <option value="terlama">Terlama</option>
                        <option value="nama_asc">Nama (A-Z)</option>
                        <option value="nama_desc">Nama (Z-A)</option>
                        <option value="role">Role</option>
                      </select>
                    </div>
                  </div>

                  {/* Di Bawah Search & Sort (Mobile) / Sebelah Kanan (Desktop): Button Tambah Pengguna */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(!showAddForm);
                      setFormError('');
                    }}
                    className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition shadow-xs active:scale-95 ${
                      showAddForm
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                        : 'bg-[#06305d] hover:bg-[#0a4583] text-white'
                    }`}
                  >
                    {showAddForm ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>Tutup Formulir</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span>Tambah Pengguna</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Formulir Tambah Pengguna (Expandable / Collapsible ketika button diklik) */}
                {showAddForm && (
                  <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#06305d]/20 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-sm font-black text-slate-900">Formulir Tambah Pengguna Admin Baru</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Lengkapi data di bawah ini untuk membuat kredensial akun panitia baru.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                      >
                        ✕ Tutup
                      </button>
                    </div>

                    <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Nama Lengkap</label>
                          <input
                            type="text"
                            placeholder="Misal: Ahmad Fauzi"
                            value={newNama}
                            onChange={(e) => setNewNama(e.target.value)}
                            required
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#06305d]/20 focus:border-[#06305d]"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Username Login</label>
                          <input
                            type="text"
                            placeholder="Misal: panitia_fauzi"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                            required
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#06305d]/20 focus:border-[#06305d]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Password</label>
                          <input
                            type="password"
                            placeholder="Minimal 6 karakter"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#06305d]/20 focus:border-[#06305d]"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Tingkat Hak Akses (Role)</label>
                          <select
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value as any)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#06305d]/20 focus:border-[#06305d]"
                          >
                            <option value="panitia">Panitia Registrasi (Verifikasi & Scanner)</option>
                            <option value="scanner">Petugas Scanner (Khusus Scanner QR Presensi)</option>
                            <option value="superadmin">Superadmin (Akses Penuh Seluruh Sistem)</option>
                          </select>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-600 border border-slate-100">
                        {newRole === 'panitia' && (
                          <span><strong>Panitia Registrasi:</strong> Memiliki wewenang melihat pendaftar, memverifikasi bukti transfer tiket, dan memindai QR code presensi.</span>
                        )}
                        {newRole === 'scanner' && (
                          <span><strong>Petugas Scanner:</strong> Dikhususkan untuk pemindaian cepat QR code tiket di gate venue acara.</span>
                        )}
                        {newRole === 'superadmin' && (
                          <span><strong>Superadmin:</strong> Wewenang penuh atas seluruh sistem, verifikasi, scanner, dan manajemen akun RBAC.</span>
                        )}
                      </div>

                      <div className="flex gap-2.5 pt-1">
                        <button
                          type="submit"
                          disabled={submittingUser}
                          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#06305d] hover:bg-[#0a4583] text-white font-bold transition shadow-xs active:scale-95 disabled:opacity-50"
                        >
                          {submittingUser ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Menyimpan Pengguna...</span>
                            </>
                          ) : (
                            <span>Simpan Pengguna Baru</span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddForm(false);
                            setFormError('');
                          }}
                          className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
                        >
                          Batal
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* List dari Pengguna yang telah ditambahkan (Di Bawah Button Tambah Pengguna) */}
                <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
                  {/* Header List */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-slate-900">List Pengguna Terdaftar</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Menampilkan {filteredUsers.length} akun pengguna
                        {userSearch && <span> untuk kata kunci "{userSearch}"</span>}
                      </p>
                    </div>

                    {userSearch && (
                      <button
                        onClick={() => setUserSearch('')}
                        className="text-xs font-bold text-sky-600 hover:text-sky-700 transition"
                      >
                        Reset Pencarian
                      </button>
                    )}
                  </div>

                  {loadingUsers ? (
                    <div className="py-12 text-center">
                      <div className="w-7 h-7 border-3 border-[#06305d] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-xs text-slate-400">Memuat data pengguna...</p>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl p-6">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <p className="text-xs font-bold text-slate-700">Tidak ada pengguna ditemukan</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {userSearch ? `Tidak ada pengguna dengan nama/username "${userSearch}"` : 'Belum ada pengguna terdaftar.'}
                      </p>
                      {userSearch && (
                        <button
                          onClick={() => setUserSearch('')}
                          className="mt-3 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition"
                        >
                          Bersihkan Pencarian
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* TAMPILAN MOBILE: LIST DARI PENGGUNA BERUPA KARTU (block sm:hidden) */}
                      <div className="space-y-3 block sm:hidden">
                        {filteredUsers.map((u) => {
                          const isMaster = u.id === 'admin_master';
                          const isMe = u.id === currentUser?.id;
                          return (
                            <div
                              key={u.id}
                              className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/90 shadow-2xs space-y-3"
                            >
                              {/* Header Kartu Pengguna */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-10 h-10 rounded-xl bg-[#06305d] text-white flex items-center justify-center font-bold text-sm shrink-0">
                                    {u.nama.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-900 text-xs truncate">{u.nama}</p>
                                    <p className="text-[11px] font-mono text-slate-500">@{u.username}</p>
                                  </div>
                                </div>
                                <div className="shrink-0">{getRoleBadge(u.role)}</div>
                              </div>

                              {/* Rincian Wewenang Operasional */}
                              <div className="p-2.5 bg-white rounded-xl border border-slate-200/60 text-[11px] text-slate-600 leading-relaxed">
                                {u.role === 'superadmin'
                                  ? 'Akses Penuh: Dashboard, Verifikasi, Scanner, Riwayat, dan RBAC'
                                  : u.role === 'panitia'
                                  ? 'Akses: Dashboard, Verifikasi Berkas Tiket, Scanner Presensi, Riwayat Scan'
                                  : 'Akses: Fast Action Scanner QR Code di Pintu Masuk'}
                              </div>

                              {/* Footer Kartu Pengguna: ID & Tombol Aksi */}
                              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px]">
                                <span className="font-mono text-slate-400 text-[10px]">ID: {u.id}</span>
                                {isMaster ? (
                                  <span className="px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-600 text-[10px] font-bold">
                                    Akun Master
                                  </span>
                                ) : isMe ? (
                                  <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-700 text-[10px] font-bold">
                                    Akun Anda
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleDeleteUser(u.id, u.nama)}
                                    className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold transition active:scale-95"
                                  >
                                    Hapus
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* TAMPILAN DESKTOP: TABEL PROPORSIONAL & RESPONSIF (hidden sm:block) */}
                      <div className="hidden sm:block rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                <th className="py-3 px-4">Pengguna</th>
                                <th className="py-3 px-4">Username</th>
                                <th className="py-3 px-4">Role</th>
                                <th className="py-3 px-4">Wewenang Operasional</th>
                                <th className="py-3 px-4 text-center">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filteredUsers.map((u) => {
                                const isMaster = u.id === 'admin_master';
                                const isMe = u.id === currentUser?.id;
                                return (
                                  <tr key={u.id} className="hover:bg-slate-50/70 transition">
                                    <td className="py-3 px-4">
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-[#06305d]/10 text-[#06305d] flex items-center justify-center font-bold text-xs shrink-0">
                                          {u.nama.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                          <p className="font-bold text-slate-900">{u.nama}</p>
                                          <p className="text-[10px] font-mono text-slate-400">{u.id}</p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 font-mono text-slate-700">@{u.username}</td>
                                    <td className="py-3 px-4">{getRoleBadge(u.role)}</td>
                                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                                      {u.role === 'superadmin'
                                        ? 'Akses Penuh (Dashboard, Verifikasi, Scanner, Riwayat, RBAC)'
                                        : u.role === 'panitia'
                                        ? 'Dashboard, Verifikasi Berkas, Scanner Presensi, Riwayat Scan'
                                        : 'Fast Action Scanner QR & Presensi'}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      {isMaster ? (
                                        <span className="text-[10px] text-slate-400 italic">Sistem</span>
                                      ) : isMe ? (
                                        <span className="text-[10px] text-slate-400 italic">Akun Anda</span>
                                      ) : (
                                        <button
                                          onClick={() => handleDeleteUser(u.id, u.nama)}
                                          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] font-bold transition active:scale-95"
                                        >
                                          Hapus
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ==========================================================
  // VIEW UTAMA: DAFTAR SUBMENU PENGATURAN (TEKS SAJA & SERAGAM)
  // ==========================================================
  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-150">
      {/* Header Utama Pengaturan */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Pengaturan</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pilih submenu di bawah untuk melihat detail profil atau hak akses pengguna (RBAC).
          </p>
        </div>
      </div>

      {/* DAFTAR SUBMENU TEKS SERAGAM */}
      <div className="space-y-3">
        {/* 1. SUBMENU: PROFIL SAYA */}
        <div
          onClick={() => openSubmenu('profil')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs hover:border-slate-300 hover:bg-slate-50/60 cursor-pointer transition-all duration-150 active:scale-[0.99] flex items-center justify-between gap-4"
        >
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">
              Profil Saya
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {currentUser?.nama || 'Administrator'} • @{currentUser?.username || 'admin'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
            <span className="text-xs font-semibold hidden sm:inline">Buka</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        {/* 2. SUBMENU: MANAJEMEN PENGGUNA (RBAC) */}
        <div
          onClick={() => openSubmenu('rbac')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs hover:border-slate-300 hover:bg-slate-50/60 cursor-pointer transition-all duration-150 active:scale-[0.99] flex items-center justify-between gap-4"
        >
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">
              Manajemen Pengguna (RBAC)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              Kelola akun admin panitia, tambah pengguna baru, dan atur wewenang akses
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
            <span className="text-xs font-semibold hidden sm:inline">Kelola</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        {/* TOMBOL KELUAR (DENGAN VALIDASI KONFIRMASI) */}
        <div className="pt-3">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold shadow-xs transition duration-150 active:scale-98"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Keluar</span>
          </button>
        </div>
      </div>

      {/* Render Modal Konfirmasi Keluar */}
      {renderLogoutModal()}
    </div>
  );
}
