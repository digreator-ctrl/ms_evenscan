import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface AdminUser {
  id: string;
  username: string;
  nama: string;
  role: string;
  created_at?: string;
}

export interface RolePermission {
  id: string;
  nama: string;
  deskripsi: string;
  kategori: string;
}

export interface RoleDefinition {
  id: string;
  nama: string;
  deskripsi: string;
  isSystem: boolean;
  warna: 'purple' | 'sky' | 'amber' | 'emerald' | 'indigo' | 'rose';
  permissions: string[];
}

export const SYSTEM_PERMISSIONS: RolePermission[] = [
  {
    id: 'dashboard',
    nama: 'Dashboard & Statistik',
    deskripsi: 'Melihat grafik pendaftar, rasio kehadiran, & ringkasan kuota acara.',
    kategori: 'Analitik & Ringkasan',
  },
  {
    id: 'verifikasi',
    nama: 'Verifikasi Berkas & Tiket WhatsApp',
    deskripsi: 'Memeriksa bukti transfer, konfirmasi validitas pembayaran, dan trigger kirim tiket WhatsApp otomatis.',
    kategori: 'Operasional Registrasi',
  },
  {
    id: 'scanner',
    nama: 'Fast Action Scanner Kamera QR',
    deskripsi: 'Memindai QR code tiket peserta menggunakan kamera perangkat di pintu masuk venue.',
    kategori: 'Presensi Acara',
  },
  {
    id: 'riwayat',
    nama: 'Riwayat Scan Peserta (History Log)',
    deskripsi: 'Melihat rekap waktu dan data peserta yang telah sukses melakukan scan presensi.',
    kategori: 'Presensi Acara',
  },
  {
    id: 'rbac',
    nama: 'Manajemen Pengguna & RBAC',
    deskripsi: 'Menambah admin panitia baru, mengelola peran (role), dan konfigurasi matriks izin sistem.',
    kategori: 'Administrasi Sistem',
  },
];

export const DEFAULT_ROLES: RoleDefinition[] = [
  {
    id: 'superadmin',
    nama: 'Superadmin',
    deskripsi: 'Akses administrator tertinggi dengan wewenang mutlak atas seluruh modul dan manajemen RBAC.',
    isSystem: true,
    warna: 'purple',
    permissions: ['dashboard', 'verifikasi', 'scanner', 'riwayat', 'rbac'],
  },
  {
    id: 'panitia',
    nama: 'Panitia Registrasi',
    deskripsi: 'Petugas meja verifikasi untuk validasi bukti transfer tiket, kirim WhatsApp, dan scan presensi.',
    isSystem: true,
    warna: 'sky',
    permissions: ['dashboard', 'verifikasi', 'scanner', 'riwayat'],
  },
  {
    id: 'scanner',
    nama: 'Petugas Scanner',
    deskripsi: 'Petugas pintu masuk venue acara yang difokuskan untuk scan presensi QR code tiket secara cepat.',
    isSystem: true,
    warna: 'amber',
    permissions: ['scanner', 'riwayat'],
  },
];

export function Pengaturan() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentSub = searchParams.get('sub'); // 'profil' | 'rbac' | null
  const rbacTabParam = searchParams.get('tab'); // 'akses' | 'tambah' | null
  const rbacView = searchParams.get('view'); // 'tambah' | 'tambah-role' | null
  const selectedUserId = searchParams.get('user_id'); // string | null
  const selectedRoleId = searchParams.get('role_id'); // string | null

  // Tab aktif di RBAC (default 'tambah')
  const rbacTab: 'akses' | 'tambah' = rbacTabParam === 'akses' ? 'akses' : 'tambah';

  // State Profil User yang Sedang Login
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);

  // State Kontrol Kuota & Pendaftaran Acara (Khusus Superadmin)
  const [pendaftaranBuka, setPendaftaranBuka] = useState<boolean>(true);
  const [loadingKuota, setLoadingKuota] = useState<boolean>(false);
  const [savingKuota, setSavingKuota] = useState<boolean>(false);
  const [kuotaUpdatedAt, setKuotaUpdatedAt] = useState<string | null>(null);
  const [kuotaFeedback, setKuotaFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // State Validasi Konfirmasi Keluar (Logout)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // State Konfirmasi Hapus Pengguna
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  // State Manajemen RBAC Pengguna (Superadmin)
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userSort, setUserSort] = useState<'terbaru' | 'terlama' | 'nama_asc' | 'nama_desc' | 'role'>('terbaru');

  // State Role & Permissions (RBAC) dengan Persistent Storage (localStorage)
  const [roles, setRoles] = useState<RoleDefinition[]>(() => {
    try {
      const saved = localStorage.getItem('evenscan_rbac_roles');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.error('Error loading roles from localStorage:', err);
    }
    return DEFAULT_ROLES;
  });

  // Simpan perubahan role ke localStorage secara otomatis
  useEffect(() => {
    try {
      localStorage.setItem('evenscan_rbac_roles', JSON.stringify(roles));
    } catch (err) {
      console.error('Error saving roles to localStorage:', err);
    }
  }, [roles]);

  // State Form Halaman Baru Buat Role Baru
  const [newRoleNama, setNewRoleNama] = useState('');
  const [newRoleDeskripsi, setNewRoleDeskripsi] = useState('');
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>(['dashboard']);
  const [createRoleSubmitted, setCreateRoleSubmitted] = useState(false);
  const [roleValidationModal, setRoleValidationModal] = useState(false);
  const [roleValidationError, setRoleValidationError] = useState('');
  const [createdRoleSuccessModal, setCreatedRoleSuccessModal] = useState(false);
  const [lastCreatedRole, setLastCreatedRole] = useState<RoleDefinition | null>(null);

  // State Edit Hak Akses di Halaman Detail Role
  const [isEditingRolePermissions, setIsEditingRolePermissions] = useState(false);
  const [detailEditPermissions, setDetailEditPermissions] = useState<string[]>([]);
  const [editRoleSuccessModal, setEditRoleSuccessModal] = useState(false);

  // State Hapus Role Kustom
  const [roleToDelete, setRoleToDelete] = useState<RoleDefinition | null>(null);
  const [roleDeleteAlertMsg, setRoleDeleteAlertMsg] = useState('');

  // Form Tambah User
  const [newNama, setNewNama] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<string>('panitia');
  const [submittingUser, setSubmittingUser] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Validasi & Modal Popup Form Tambah User
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedUserData, setSavedUserData] = useState<{ nama: string; username: string; role: string } | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'superadmin') {
      fetchKuotaSetting();
    }
  }, [currentUser]);

  const fetchKuotaSetting = async () => {
    setLoadingKuota(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/settings/pendaftaran`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPendaftaranBuka(Boolean(data.pendaftaran_buka));
        setKuotaUpdatedAt(data.updated_at || null);
      }
    } catch (err) {
      console.error('Gagal mengambil status kuota:', err);
    } finally {
      setLoadingKuota(false);
    }
  };

  const handleToggleKuota = async (targetStatus: boolean) => {
    setSavingKuota(true);
    setKuotaFeedback(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/settings/pendaftaran`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pendaftaran_buka: targetStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengubah status pendaftaran');
      }
      setPendaftaranBuka(Boolean(data.pendaftaran_buka));
      setKuotaUpdatedAt(data.updated_at || null);
      setKuotaFeedback({
        type: 'success',
        message: targetStatus
          ? 'Status berhasil diubah: Kuota Acara DIBUKA (Pendaftaran peserta aktif).'
          : 'Status berhasil diubah: Kuota Acara DITUTUP (Pendaftaran peserta dinonaktifkan).',
      });
    } catch (err: any) {
      setKuotaFeedback({
        type: 'error',
        message: err.message || 'Terjadi kesalahan sistem saat memperbarui status kuota.',
      });
    } finally {
      setSavingKuota(false);
    }
  };

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

  // ==========================================================
  // NAVIGASI PENGELOLAAN AKSES: BUAT ROLE & DETAIL ROLE
  // ==========================================================
  const openCreateRolePage = () => {
    setNewRoleNama('');
    setNewRoleDeskripsi('');
    setNewRolePermissions(['dashboard']);
    setCreateRoleSubmitted(false);
    setRoleValidationModal(false);
    setSearchParams({ sub: 'rbac', tab: 'akses', view: 'tambah-role' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openRoleDetail = (roleId: string) => {
    const r = roles.find((item) => item.id === roleId);
    if (r) {
      setDetailEditPermissions([...r.permissions]);
    }
    setIsEditingRolePermissions(false);
    setSearchParams({ sub: 'rbac', tab: 'akses', role_id: roleId });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const backToRbacAkses = () => {
    setIsEditingRolePermissions(false);
    setRoleToDelete(null);
    setSearchParams({ sub: 'rbac', tab: 'akses' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ==========================================================
  // LOGIKA HALAMAN BARU: SIMPAN ROLE BARU
  // ==========================================================
  const handleToggleNewRolePermission = (permId: string) => {
    setNewRolePermissions((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
  };

  const handleSelectAllNewRolePermissions = () => {
    setNewRolePermissions(SYSTEM_PERMISSIONS.map((p) => p.id));
  };

  const handleClearAllNewRolePermissions = () => {
    setNewRolePermissions([]);
  };

  const handleSaveNewRole = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateRoleSubmitted(true);

    if (!newRoleNama.trim()) {
      setRoleValidationError('Bagian Nama Role wajib terisi.');
      setRoleValidationModal(true);
      return;
    }

    if (newRolePermissions.length === 0) {
      setRoleValidationError('Pilih minimal satu hak akses modul sistem untuk role ini.');
      setRoleValidationModal(true);
      return;
    }

    // Buat slug ID unik
    const baseId = newRoleNama
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .slice(0, 20);
    const uniqueId = roles.some((r) => r.id === baseId)
      ? `${baseId}_${Math.floor(Math.random() * 900 + 100)}`
      : baseId;

    const newRoleObj: RoleDefinition = {
      id: uniqueId,
      nama: newRoleNama.trim(),
      deskripsi: newRoleDeskripsi.trim() || `Role kustom ${newRoleNama.trim()} dengan wewenang khusus.`,
      isSystem: false,
      warna: 'emerald',
      permissions: newRolePermissions,
    };

    setRoles((prev) => [...prev, newRoleObj]);
    setLastCreatedRole(newRoleObj);
    setCreatedRoleSuccessModal(true);
  };

  const handleCloseCreatedRoleSuccessModal = () => {
    setCreatedRoleSuccessModal(false);
    setLastCreatedRole(null);
    setNewRoleNama('');
    setNewRoleDeskripsi('');
    setNewRolePermissions(['dashboard']);
    setCreateRoleSubmitted(false);
    backToRbacAkses();
  };

  // ==========================================================
  // LOGIKA HALAMAN DETAIL ROLE: EDIT PERMISSIONS & HAPUS
  // ==========================================================
  const handleToggleDetailPermission = (permId: string) => {
    setDetailEditPermissions((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
  };

  const handleSaveDetailRolePermissions = (roleId: string) => {
    if (detailEditPermissions.length === 0) {
      alert('Role harus memiliki minimal satu hak akses modul aktif.');
      return;
    }

    setRoles((prev) =>
      prev.map((r) => (r.id === roleId ? { ...r, permissions: detailEditPermissions } : r))
    );

    setIsEditingRolePermissions(false);
    setEditRoleSuccessModal(true);
  };

  const handleRequestDeleteRole = (role: RoleDefinition) => {
    if (role.isSystem) return;

    // Hitung pengguna yang sedang menggunakan role ini
    const count = users.filter(
      (u) => u.role === role.id || u.role.toLowerCase() === role.nama.toLowerCase()
    ).length;

    if (count > 0) {
      setRoleDeleteAlertMsg(
        `Role "${role.nama}" tidak dapat dihapus karena saat ini masih digunakan oleh ${count} pengguna terdaftar. Ubah role akun pengguna tersebut terlebih dahulu.`
      );
      return;
    }

    setRoleToDelete(role);
  };

  const confirmDeleteRole = () => {
    if (!roleToDelete || roleToDelete.isSystem) return;

    setRoles((prev) => prev.filter((r) => r.id !== roleToDelete.id));
    setRoleToDelete(null);
    backToRbacAkses();
  };

  // ==========================================================
  // LOGIKA TAMBAH PENGGUNA BARU
  // ==========================================================
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
    setFormError('');
    setFormSuccess('');

    const isNamaEmpty = !newNama.trim();
    const isUsernameEmpty = !newUsername.trim();
    const isPasswordEmpty = !newPassword.trim();
    const isPasswordTooShort = newPassword.trim().length > 0 && newPassword.trim().length < 6;

    const errors: string[] = [];
    if (isNamaEmpty) errors.push('Nama Lengkap wajib diisi');
    if (isUsernameEmpty) errors.push('Username Login wajib diisi');
    if (isPasswordEmpty) errors.push('Password wajib diisi');
    else if (isPasswordTooShort) errors.push('Password minimal 6 karakter');

    // Jika ada kolom yang masih kosong atau tidak valid: Munculkan Modal Notifikasi
    if (errors.length > 0) {
      setValidationErrors(errors);
      setShowValidationModal(true);
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
          nama: newNama.trim(),
          username: newUsername.trim().toLowerCase(),
          password: newPassword,
          role: newRole,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setFormError(json.error || 'Gagal menambahkan pengguna');
        return;
      }

      // Simpan data pengguna yang baru tersimpan untuk ditampilkan di Modal Popup Sukses
      setSavedUserData({
        nama: newNama.trim(),
        username: newUsername.trim().toLowerCase(),
        role: newRole,
      });
      setShowSuccessModal(true);

      // Refresh data pengguna di background
      await fetchUsers();
    } catch (err: any) {
      setFormError('Terjadi kesalahan jaringan: ' + err.message);
    } finally {
      setSubmittingUser(false);
    }
  };

  // Tutup Modal Sukses dan kembali ke tab halaman tambah pengguna
  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
    setFormSuccess(
      savedUserData
        ? `Pengguna "${savedUserData.nama}" (@${savedUserData.username}) berhasil ditambahkan!`
        : 'Pengguna baru berhasil ditambahkan!'
    );
    setSavedUserData(null);
    setNewNama('');
    setNewUsername('');
    setNewPassword('');
    setNewRole('panitia');
    setFormSubmitted(false);
    backToRbacTab('tambah');
  };

  const getAllUsers = (): AdminUser[] => {
    return [
      {
        id: 'admin_master',
        username: 'admin',
        nama: 'Administrator Muslim Scene',
        role: 'superadmin',
        created_at: '2026-01-01T00:00:00Z',
      },
      ...users,
    ];
  };

  const getFilteredAndSortedUsers = () => {
    const allList = getAllUsers();
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

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setDeletingUser(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
        setFormSuccess(`Pengguna "${userToDelete.nama}" (@${userToDelete.username}) berhasil dihapus.`);
        setUserToDelete(null);
        backToRbacTab('tambah');
      } else {
        const json = await res.json();
        alert(json.error || 'Gagal menghapus pengguna');
      }
    } catch (err) {
      alert('Gagal menghapus pengguna: Terjadi kesalahan jaringan');
    } finally {
      setDeletingUser(false);
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const openSubmenu = (sub: string) => {
    if (sub === 'rbac') {
      setSearchParams({ sub: 'rbac', tab: 'tambah' });
    } else {
      setSearchParams({ sub });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const backToMenu = () => {
    setSearchParams({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const switchRbacTab = (tab: 'akses' | 'tambah') => {
    setSearchParams({ sub: 'rbac', tab });
    setFormError('');
  };

  const openAddUserPage = () => {
    setFormError('');
    setFormSubmitted(false);
    setShowValidationModal(false);
    setShowSuccessModal(false);
    setSearchParams({ sub: 'rbac', tab: 'tambah', view: 'tambah' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openUserProfile = (userId: string) => {
    setSearchParams({ sub: 'rbac', tab: 'tambah', user_id: userId });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const backToRbacTab = (tab: 'akses' | 'tambah' = 'tambah') => {
    setFormSubmitted(false);
    setShowValidationModal(false);
    setShowSuccessModal(false);
    setSearchParams({ sub: 'rbac', tab });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getRoleBadge = (role: string) => {
    const roleDef = roles.find((r) => r.id === role || r.nama.toLowerCase() === role.toLowerCase());

    if (role === 'superadmin') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-black uppercase tracking-wider border border-purple-200">
          ★ Superadmin
        </span>
      );
    }
    if (role === 'panitia') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-black uppercase tracking-wider border border-sky-200">
          ✓ Panitia Registrasi
        </span>
      );
    }
    if (role === 'scanner') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider border border-amber-200">
          ⎚ Petugas Scanner
        </span>
      );
    }

    if (roleDef) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider border border-emerald-200">
          ◆ {roleDef.nama}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[10px] font-bold">
        {role}
      </span>
    );
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Tidak diketahui';
    try {
      const d = new Date(isoString);
      return (
        d.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }) + ' WIB'
      );
    } catch {
      return isoString;
    }
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

  const renderDeleteUserModal = () => {
    if (!userToDelete) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
        <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-150">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>

          <h3 className="text-base font-black text-slate-900 mb-1.5">Hapus Pengguna?</h3>
          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            Apakah Anda yakin ingin menghapus pengguna <strong className="text-slate-800">{userToDelete.nama}</strong> (@{userToDelete.username})? Akun ini tidak akan dapat login lagi ke sistem.
          </p>

          <div className="flex gap-2.5">
            <button
              type="button"
              disabled={deletingUser}
              onClick={() => setUserToDelete(null)}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition active:scale-95"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={deletingUser}
              onClick={confirmDeleteUser}
              className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm active:scale-95 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              {deletingUser ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menghapus...</span>
                </>
              ) : (
                <span>Ya, Hapus</span>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Modal Notifikasi Popup Validasi Kolom Kosong Form Tambah Pengguna
   */
  const renderValidationModal = () => {
    if (!showValidationModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
        <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-rose-100 text-center animate-in zoom-in-95 duration-150">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-4 shadow-xs">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h3 className="text-base font-black text-slate-900 mb-1.5">Bagian Formulir Wajib Terisi</h3>
          <p className="text-xs text-slate-500 leading-relaxed mb-4">
            Terdapat kolom yang masih kosong atau belum memenuhi syarat. Mohon lengkapi bagian berikut sebelum menyimpan:
          </p>

          <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-3 mb-5 text-left text-xs space-y-1.5">
            {validationErrors.map((err, idx) => (
              <div key={idx} className="flex items-center gap-2 text-rose-800 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
                <span>{err}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowValidationModal(false)}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer"
          >
            Mengerti, Lengkapi Data
          </button>
        </div>
      </div>
    );
  };

  /**
   * Modal Notifikasi Popup Sukses Data Pengguna Tersimpan
   */
  const renderSuccessModal = () => {
    if (!showSuccessModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
        <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-emerald-100 text-center animate-in zoom-in-95 duration-150">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto mb-4 shadow-xs">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h3 className="text-lg font-black text-slate-900 mb-1.5">Data Berhasil Disimpan!</h3>
          <p className="text-xs text-slate-600 leading-relaxed mb-4">
            Pengguna <strong className="text-slate-900 font-black">{savedUserData?.nama}</strong> (@{savedUserData?.username}) dengan role <strong className="text-slate-900 font-black capitalize">{savedUserData?.role}</strong> telah sukses tersimpan dan terdaftar ke dalam sistem.
          </p>

          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl mb-5 text-[11px] text-emerald-800 font-semibold flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Akun siap digunakan untuk login admin</span>
          </div>

          <button
            type="button"
            onClick={handleCloseSuccessModal}
            className="w-full py-2.5 rounded-xl bg-[#06305d] hover:bg-[#0a4583] text-white text-xs font-bold transition shadow-sm active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Kembali ke Halaman Tambah Pengguna</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  /**
   * Render Komponen Halaman Profil Pengguna
   */
  const renderUserProfileView = (
    user: AdminUser,
    isSelf: boolean,
    onBack: () => void,
    backLabel: string
  ) => {
    const isMaster = user.id === 'admin_master';
    const canDelete = currentUser?.role === 'superadmin' && !isSelf && !isMaster;
    const userRoleDef = roles.find((r) => r.id === user.role || r.nama.toLowerCase() === user.role.toLowerCase());

    const hasPermission = (permId: string) => {
      if (user.role === 'superadmin') return true;
      return userRoleDef ? userRoleDef.permissions.includes(permId) : false;
    };

    return (
      <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-150">
        {/* Tombol Back */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 shadow-xs transition active:scale-95 cursor-pointer"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
            <span>Kembali</span>
            <span className="hidden sm:inline"> {backLabel}</span>
          </button>
          <span className="hidden sm:inline text-xs text-slate-400">/</span>
          <span className="hidden sm:inline text-xs font-semibold text-slate-600">
            {isSelf ? 'Detail Profil Saya' : `Profil ${user.nama}`}
          </span>
        </div>

        {/* Kartu Profil Utama */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#06305d] to-[#0a529b] text-white flex items-center justify-center font-black text-2xl shadow-md shrink-0">
              {user.nama?.charAt(0).toUpperCase() || 'A'}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-xl font-black text-slate-900 leading-tight">
                  {user.nama}
                </h2>
                {getRoleBadge(user.role)}
              </div>
              <p className="text-xs text-slate-500 font-mono">@{user.username}</p>
              <p className="text-[11px] text-slate-400 mt-1">ID Pengguna: {user.id}</p>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-1.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {isSelf ? 'Sesi Aktif' : 'Akun Aktif'}
              </span>
              {user.created_at && (
                <span className="text-[10px] text-slate-400">
                  Terdaftar: {formatDate(user.created_at)}
                </span>
              )}
            </div>
          </div>

          <div className="pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 bg-slate-50 rounded-2xl">
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Hak Akses Role</p>
              <p className="font-bold text-slate-800 mt-0.5 capitalize">{userRoleDef?.nama || user.role}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                {userRoleDef?.deskripsi || 'Peran pengguna operasional sistem EvenScan.'}
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

          {/* Rincian Izin Wewenang Akun Dinamis Sesuai Role */}
          <div className="pt-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              Daftar Wewenang Akun
            </h4>
            <div className="space-y-2 text-xs">
              {SYSTEM_PERMISSIONS.map((perm) => {
                const allowed = hasPermission(perm.id);
                return (
                  <div key={perm.id} className="flex items-center gap-2">
                    {allowed ? (
                      <>
                        <span className="text-emerald-600 font-bold">✓</span>
                        <span className="text-slate-800 font-medium">{perm.nama}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-slate-300">✗</span>
                        <span className="text-slate-400">{perm.nama} (Tidak ada izin)</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Aksi Tambahan: Keluar Akun jika Self, atau Hapus jika Superadmin melihat user lain */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              {isMaster && (
                <span className="text-xs font-semibold text-slate-400 italic">
                  Akun Master Sistem — Terproteksi dari penghapusan
                </span>
              )}
              {isSelf && !isMaster && (
                <span className="text-xs font-semibold text-sky-700">
                  Ini adalah akun yang sedang Anda gunakan saat ini.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isSelf && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition active:scale-95 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Keluar dari Akun Ini</span>
                </button>
              )}

              {canDelete && (
                <button
                  type="button"
                  onClick={() => setUserToDelete(user)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition active:scale-95 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Hapus Pengguna Ini</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {renderLogoutModal()}
        {renderDeleteUserModal()}
      </div>
    );
  };

  // ==========================================================
  // VIEW 1: DETAIL SUBMENU PROFIL ADMIN (DARI MENU UTAMA PENGATURAN)
  // ==========================================================
  if (currentSub === 'profil') {
    const profileToShow = currentUser || {
      id: 'admin_master',
      username: 'admin',
      nama: 'Administrator Muslim Scene',
      role: 'superadmin',
    };
    return renderUserProfileView(profileToShow, true, backToMenu, 'ke Pengaturan');
  }

  // ==========================================================
  // VIEW 2: DETAIL SUBMENU MANAJEMEN PENGGUNA (RBAC)
  // ==========================================================
  if (currentSub === 'rbac') {
    // --------------------------------------------------------
    // KONDISI 2A: NON-SUPERADMIN (LOCKED STATE)
    // --------------------------------------------------------
    if (currentUser?.role !== 'superadmin') {
      return (
        <div className="max-w-4xl mx-auto space-y-5 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={backToMenu}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 shadow-xs transition active:scale-95 cursor-pointer"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
              </svg>
              <span>Kembali ke Pengaturan</span>
            </button>
          </div>

          <div className="bg-white rounded-3xl p-8 border border-amber-200 shadow-xs text-center max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-200">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-base font-black text-slate-800 mb-1">Akses Terbatas: Khusus Superadmin</h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Akun Anda memiliki role <strong className="text-slate-800">{currentUser?.role}</strong>. Modul penambahan pengguna dan konfigurasi hak akses (RBAC) hanya dapat dikelola oleh Superadmin.
            </p>
            <button
              onClick={backToMenu}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
            >
              Kembali ke Menu Pengaturan
            </button>
          </div>
        </div>
      );
    }

    // --------------------------------------------------------
    // KONDISI 2B: HALAMAN BARU FORM TAMBAH PENGGUNA
    // --------------------------------------------------------
    if (rbacTab === 'tambah' && rbacView === 'tambah') {
      const isNamaEmpty = formSubmitted && !newNama.trim();
      const isUsernameEmpty = formSubmitted && !newUsername.trim();
      const isPasswordEmpty = formSubmitted && !newPassword.trim();
      const isPasswordTooShort = formSubmitted && newPassword.trim().length > 0 && newPassword.trim().length < 6;
      const isPasswordInvalid = isPasswordEmpty || isPasswordTooShort;

      return (
        <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-150">
          {/* Tombol Back ke Tab Tambah Pengguna */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => backToRbacTab('tambah')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 shadow-xs transition active:scale-95 cursor-pointer"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
              </svg>
              <span>Kembali</span>
              <span className="hidden sm:inline"> ke Tambah Pengguna</span>
            </button>
            <span className="hidden sm:inline text-xs text-slate-400">/</span>
            <span className="hidden sm:inline text-xs font-semibold text-slate-600">Tambah Pengguna Baru</span>
          </div>

          {/* Form Card Baru */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900">Formulir Tambah Pengguna Baru</h2>
              <p className="text-xs text-slate-500 mt-1">
                Lengkapi seluruh kolom data di bawah ini untuk membuat kredensial akun panitia baru. Semua kolom dengan tanda bintang (*) wajib diisi.
              </p>
            </div>

            {formError && (
              <div className="p-3.5 bg-rose-50 text-rose-700 text-xs rounded-2xl border border-rose-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{formError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormError('')}
                  className="text-rose-700 hover:text-rose-900 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            <form noValidate onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block font-bold mb-1.5 ${isNamaEmpty ? 'text-rose-600' : 'text-slate-700'}`}>
                    Nama Lengkap <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Misal: Ahmad Fauzi"
                    value={newNama}
                    onChange={(e) => setNewNama(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition ${
                      isNamaEmpty
                        ? 'bg-rose-50/50 border-2 border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600'
                        : 'bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-[#06305d]/20 focus:border-[#06305d]'
                    }`}
                  />
                  {isNamaEmpty && (
                    <p className="text-[11px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                      <span>⚠</span> Bagian Nama Lengkap wajib terisi
                    </p>
                  )}
                </div>

                <div>
                  <label className={`block font-bold mb-1.5 ${isUsernameEmpty ? 'text-rose-600' : 'text-slate-700'}`}>
                    Username Login <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Misal: panitia_fauzi"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    className={`w-full px-3.5 py-2.5 rounded-xl font-mono text-slate-800 placeholder-slate-400 focus:outline-none transition ${
                      isUsernameEmpty
                        ? 'bg-rose-50/50 border-2 border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600'
                        : 'bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-[#06305d]/20 focus:border-[#06305d]'
                    }`}
                  />
                  {isUsernameEmpty && (
                    <p className="text-[11px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                      <span>⚠</span> Bagian Username Login wajib terisi
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block font-bold mb-1.5 ${isPasswordInvalid ? 'text-rose-600' : 'text-slate-700'}`}>
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Minimal 6 karakter"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition ${
                      isPasswordInvalid
                        ? 'bg-rose-50/50 border-2 border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600'
                        : 'bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-[#06305d]/20 focus:border-[#06305d]'
                    }`}
                  />
                  {isPasswordEmpty && (
                    <p className="text-[11px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                      <span>⚠</span> Bagian Password wajib terisi
                    </p>
                  )}
                  {isPasswordTooShort && (
                    <p className="text-[11px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                      <span>⚠</span> Password minimal 6 karakter
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Tingkat Hak Akses (Role)</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#06305d]/20 focus:border-[#06305d] cursor-pointer"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nama} {r.isSystem ? '' : '(Role Kustom)'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Box Info Dinamis Hak Akses Role Terpilih */}
              <div className="p-3.5 bg-slate-50 rounded-2xl text-[11px] text-slate-600 border border-slate-100">
                {(() => {
                  const activeRoleDef = roles.find((r) => r.id === newRole);
                  if (!activeRoleDef) return null;
                  return (
                    <div>
                      <div className="font-bold text-slate-900 mb-1">
                        {activeRoleDef.nama}: <span className="font-normal text-slate-600">{activeRoleDef.deskripsi}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="text-[10px] font-bold text-slate-400 mr-1 self-center">Wewenang:</span>
                        {activeRoleDef.permissions.map((pId) => {
                          const perm = SYSTEM_PERMISSIONS.find((p) => p.id === pId);
                          return (
                            <span
                              key={pId}
                              className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-semibold text-[10px]"
                            >
                              ✓ {perm?.nama || pId}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={submittingUser}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#06305d] hover:bg-[#0a4583] text-white font-bold transition shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
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
                  onClick={() => backToRbacTab('tambah')}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>

          {/* Render Modal Validasi & Modal Sukses Khusus Formulir Tambah Pengguna */}
          {renderValidationModal()}
          {renderSuccessModal()}
        </div>
      );
    }

    // --------------------------------------------------------
    // KONDISI 2C: HALAMAN BARU FORM BUAT ROLE BARU
    // --------------------------------------------------------
    if (rbacTab === 'akses' && rbacView === 'tambah-role') {
      const isRoleNamaEmpty = createRoleSubmitted && !newRoleNama.trim();
      const isRolePermissionsEmpty = createRoleSubmitted && newRolePermissions.length === 0;

      return (
        <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-150">
          {/* Tombol Back ke Pengelolaan Akses */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={backToRbacAkses}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 shadow-xs transition active:scale-95 cursor-pointer"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
              </svg>
              <span>Kembali</span>
              <span className="hidden sm:inline"> ke Pengelolaan Akses</span>
            </button>
            <span className="hidden sm:inline text-xs text-slate-400">/</span>
            <span className="hidden sm:inline text-xs font-semibold text-slate-600">Buat Role Baru</span>
          </div>

          {/* Form Card Buat Role Baru */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900">Formulir Buat Role Baru & Hak Akses</h2>
              <p className="text-xs text-slate-500 mt-1">
                Tentukan nama peran kustom dan pilih wewenang modul sistem apa saja yang diizinkan untuk peran ini. Semua kolom bertanda (*) wajib diisi.
              </p>
            </div>

            <form noValidate onSubmit={handleSaveNewRole} className="space-y-4 text-xs">
              <div>
                <label className={`block font-bold mb-1.5 ${isRoleNamaEmpty ? 'text-rose-600' : 'text-slate-700'}`}>
                  Nama Role Baru <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Misal: Keuangan & Kasir, Koordinator VIP, Staf Logistik, dll."
                  value={newRoleNama}
                  onChange={(e) => setNewRoleNama(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition ${
                    isRoleNamaEmpty
                      ? 'bg-rose-50/50 border-2 border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600'
                      : 'bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-[#06305d]/20 focus:border-[#06305d]'
                  }`}
                />
                {isRoleNamaEmpty && (
                  <p className="text-[11px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                    <span>⚠</span> Bagian Nama Role wajib terisi
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Deskripsi Tugas & Wewenang</label>
                <textarea
                  rows={2}
                  placeholder="Jelaskan ringkasan tugas dan tanggung jawab peran ini..."
                  value={newRoleDeskripsi}
                  onChange={(e) => setNewRoleDeskripsi(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#06305d]/20 focus:border-[#06305d] resize-none"
                />
              </div>

              {/* Checklist Hak Akses Modul */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className={`block font-bold ${isRolePermissionsEmpty ? 'text-rose-600' : 'text-slate-700'}`}>
                    Konfigurasi Hak Akses Modul Sistem <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={handleSelectAllNewRolePermissions}
                      className="text-[#06305d] font-bold hover:underline cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={handleClearAllNewRolePermissions}
                      className="text-slate-400 font-bold hover:text-slate-600 cursor-pointer"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>

                <div className={`space-y-2 rounded-2xl p-2 transition ${isRolePermissionsEmpty ? 'border-2 border-rose-400 bg-rose-50/20' : ''}`}>
                  {SYSTEM_PERMISSIONS.map((perm) => {
                    const isChecked = newRolePermissions.includes(perm.id);
                    return (
                      <div
                        key={perm.id}
                        onClick={() => handleToggleNewRolePermission(perm.id)}
                        className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-start gap-3.5 ${
                          isChecked
                            ? 'bg-[#06305d]/5 border-[#06305d] text-[#06305d]'
                            : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-0.5 rounded text-[#06305d] focus:ring-[#06305d] cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs text-slate-900">{perm.nama}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{perm.deskripsi}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {isRolePermissionsEmpty && (
                  <p className="text-[11px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                    <span>⚠</span> Pilih minimal satu hak akses modul sistem untuk role ini
                  </p>
                )}
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#06305d] hover:bg-[#0a4583] text-white font-bold transition shadow-xs active:scale-95 cursor-pointer"
                >
                  <span>Simpan Role Baru</span>
                </button>
                <button
                  type="button"
                  onClick={backToRbacAkses}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>

          {/* Modal Validasi Role */}
          {roleValidationModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
              <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-rose-100 text-center animate-in zoom-in-95 duration-150">
                <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-4 shadow-xs">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>

                <h3 className="text-base font-black text-slate-900 mb-1.5">Bagian Formulir Wajib Terisi</h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">{roleValidationError}</p>

                <button
                  type="button"
                  onClick={() => setRoleValidationModal(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer"
                >
                  Mengerti, Lengkapi Data
                </button>
              </div>
            </div>
          )}

          {/* Modal Sukses Buat Role Baru */}
          {createdRoleSuccessModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
              <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-emerald-100 text-center animate-in zoom-in-95 duration-150">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto mb-4 shadow-xs">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <h3 className="text-lg font-black text-slate-900 mb-1.5">Role Baru Berhasil Dibuat!</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Role <strong className="text-slate-900 font-black">{lastCreatedRole?.nama}</strong> telah sukses tersimpan dengan {lastCreatedRole?.permissions.length} hak akses modul aktif. Role ini kini dapat langsung dipilih saat menambah pengguna baru.
                </p>

                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl mb-5 text-[11px] text-emerald-800 font-semibold flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Role kustom aktif di sistem</span>
                </div>

                <button
                  type="button"
                  onClick={handleCloseCreatedRoleSuccessModal}
                  className="w-full py-2.5 rounded-xl bg-[#06305d] hover:bg-[#0a4583] text-white text-xs font-bold transition shadow-sm active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Kembali ke Pengelolaan Akses</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    // --------------------------------------------------------
    // KONDISI 2D: HALAMAN DETAIL ROLE TERSEBUT
    // --------------------------------------------------------
    if (rbacTab === 'akses' && selectedRoleId) {
      const activeRole = roles.find((r) => r.id === selectedRoleId);

      if (!activeRole) {
        return (
          <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={backToRbacAkses}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 shadow-xs transition active:scale-95 cursor-pointer"
              >
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                </svg>
                <span>Kembali ke Pengelolaan Akses</span>
              </button>
            </div>

            <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center shadow-xs">
              <p className="text-sm font-bold text-slate-800">Role Tidak Ditemukan</p>
              <p className="text-xs text-slate-500 mt-1">Data role mungkin telah dihapus.</p>
              <button
                onClick={backToRbacAkses}
                className="mt-4 px-4 py-2 rounded-xl bg-[#06305d] text-white text-xs font-bold cursor-pointer"
              >
                Kembali ke Daftar Role
              </button>
            </div>
          </div>
        );
      }

      const usersWithThisRole =
        (activeRole.id === 'superadmin' ? 1 : 0) +
        users.filter((u) => u.role === activeRole.id || u.role.toLowerCase() === activeRole.nama.toLowerCase()).length;

      return (
        <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-150">
          {/* Tombol Back */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={backToRbacAkses}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 shadow-xs transition active:scale-95 cursor-pointer"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
              </svg>
              <span>Kembali</span>
              <span className="hidden sm:inline"> ke Pengelolaan Akses</span>
            </button>
            <span className="hidden sm:inline text-xs text-slate-400">/</span>
            <span className="hidden sm:inline text-xs font-semibold text-slate-600">Detail Role: {activeRole.nama}</span>
          </div>

          {/* Kartu Profil Detail Role */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#06305d] to-[#0a529b] text-white flex items-center justify-center font-black text-2xl shadow-md shrink-0">
                {activeRole.nama.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h2 className="text-xl font-black text-slate-900 leading-tight">{activeRole.nama}</h2>
                  {activeRole.isSystem ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                      Role Bawaan Sistem
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                      Role Kustom
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-mono">Kode ID: {activeRole.id}</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Digunakan oleh {usersWithThisRole} akun pengguna terdaftar
                </p>
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold self-start sm:self-auto">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Role Aktif
              </span>
            </div>

            {/* Deskripsi Role */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Deskripsi & Ruang Lingkup Peran</p>
              <p className="text-slate-700 leading-relaxed">{activeRole.deskripsi}</p>
            </div>

            {/* Proteksi Khusus Superadmin */}
            {activeRole.id === 'superadmin' ? (
              <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl text-xs text-purple-900">
                <p className="font-bold flex items-center gap-1.5">
                  <span>★</span> Role Superadmin Terproteksi
                </p>
                <p className="text-[11px] text-purple-700 mt-0.5 leading-relaxed">
                  Superadmin adalah peran administrator inti dan memiliki hak akses 100% pada seluruh modul demi integritas tata kelola sistem.
                </p>
              </div>
            ) : null}

            {/* Rincian Hak Akses Modul Sistem */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Rincian Wewenang Modul Sistem
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {activeRole.permissions.length} dari {SYSTEM_PERMISSIONS.length} modul aktif diizinkan
                  </p>
                </div>

                {activeRole.id !== 'superadmin' && !isEditingRolePermissions && (
                  <button
                    type="button"
                    onClick={() => {
                      setDetailEditPermissions([...activeRole.permissions]);
                      setIsEditingRolePermissions(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#06305d] hover:bg-[#0a4583] text-white text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Ubah Hak Akses Modul</span>
                  </button>
                )}
              </div>

              {/* Mode Edit vs Mode Lihat */}
              {isEditingRolePermissions ? (
                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <p className="text-xs font-bold text-slate-800">Pilih Modul yang Diizinkan:</p>
                    <div className="flex gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setDetailEditPermissions(SYSTEM_PERMISSIONS.map((p) => p.id))}
                        className="text-[#06305d] font-bold hover:underline cursor-pointer"
                      >
                        Pilih Semua
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={() => setDetailEditPermissions([])}
                        className="text-slate-400 font-bold hover:text-slate-600 cursor-pointer"
                      >
                        Kosongkan
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {SYSTEM_PERMISSIONS.map((perm) => {
                      const isChecked = detailEditPermissions.includes(perm.id);
                      return (
                        <div
                          key={perm.id}
                          onClick={() => handleToggleDetailPermission(perm.id)}
                          className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                            isChecked
                              ? 'bg-white border-[#06305d] shadow-2xs text-[#06305d]'
                              : 'bg-white/60 border-slate-200 text-slate-500 hover:bg-white'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="mt-0.5 rounded text-[#06305d] focus:ring-[#06305d] cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-xs text-slate-900">{perm.nama}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">{perm.deskripsi}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => handleSaveDetailRolePermissions(activeRole.id)}
                      className="px-4 py-2 rounded-xl bg-[#06305d] hover:bg-[#0a4583] text-white text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer"
                    >
                      Simpan Perubahan Hak Akses
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingRolePermissions(false)}
                      className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  {SYSTEM_PERMISSIONS.map((perm) => {
                    const isAllowed =
                      activeRole.id === 'superadmin' ? true : activeRole.permissions.includes(perm.id);
                    return (
                      <div
                        key={perm.id}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                          isAllowed ? 'bg-slate-50 border-slate-200/90' : 'bg-slate-50/40 border-slate-100 opacity-60'
                        }`}
                      >
                        <div>
                          <p className={`font-bold ${isAllowed ? 'text-slate-900' : 'text-slate-500'}`}>
                            {perm.nama}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{perm.deskripsi}</p>
                        </div>

                        {isAllowed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px] shrink-0">
                            <span>✓</span>
                            <span>Diizinkan</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-400 border border-slate-200 font-bold text-[11px] shrink-0">
                            <span>✗</span>
                            <span>Tidak Diizinkan</span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Aksi Tambahan: Hapus Role Kustom */}
            {!activeRole.isSystem && (
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500">
                  Role kustom dapat dihapus selama tidak ada akun yang sedang menggunakannya.
                </span>

                <button
                  type="button"
                  onClick={() => handleRequestDeleteRole(activeRole)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition active:scale-95 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Hapus Role Ini</span>
                </button>
              </div>
            )}
          </div>

          {/* Modal Sukses Update Hak Akses */}
          {editRoleSuccessModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
              <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-emerald-100 text-center animate-in zoom-in-95 duration-150">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto mb-4 shadow-xs">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <h3 className="text-base font-black text-slate-900 mb-1.5">Hak Akses Berhasil Diperbarui!</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Wewenang hak akses modul untuk role <strong>{activeRole.nama}</strong> telah sukses diperbarui dan diterapkan ke seluruh pengguna terkait.
                </p>

                <button
                  type="button"
                  onClick={() => setEditRoleSuccessModal(false)}
                  className="w-full py-2.5 rounded-xl bg-[#06305d] hover:bg-[#0a4583] text-white text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            </div>
          )}

          {/* Modal Alert Tidak Bisa Hapus Karena Sedang Digunakan */}
          {roleDeleteAlertMsg && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
              <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-amber-200 text-center animate-in zoom-in-95 duration-150">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto mb-4 shadow-xs">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>

                <h3 className="text-base font-black text-slate-900 mb-1.5">Tidak Dapat Menghapus Role</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-5">{roleDeleteAlertMsg}</p>

                <button
                  type="button"
                  onClick={() => setRoleDeleteAlertMsg('')}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer"
                >
                  Mengerti
                </button>
              </div>
            </div>
          )}

          {/* Modal Konfirmasi Hapus Role */}
          {roleToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
              <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-150">
                <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>

                <h3 className="text-base font-black text-slate-900 mb-1.5">Hapus Role "{roleToDelete.nama}"?</h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-6">
                  Apakah Anda yakin ingin menghapus role kustom ini? Aksi ini tidak dapat dibatalkan.
                </p>

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setRoleToDelete(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition active:scale-95 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteRole}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer"
                  >
                    Ya, Hapus
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // --------------------------------------------------------
    // KONDISI 2E: HALAMAN PROFIL PENGGUNA TERPILIH DARI LIST
    // --------------------------------------------------------
    if (selectedUserId) {
      const allUsers = getAllUsers();
      const targetUser = allUsers.find((u) => u.id === selectedUserId);

      if (!targetUser) {
        return (
          <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => backToRbacTab('tambah')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 shadow-xs transition active:scale-95 cursor-pointer"
              >
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                </svg>
                <span>Kembali ke Tambah Pengguna</span>
              </button>
            </div>

            <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center shadow-xs">
              <p className="text-sm font-bold text-slate-800">Pengguna Tidak Ditemukan</p>
              <p className="text-xs text-slate-500 mt-1">Data pengguna mungkin telah dihapus.</p>
              <button
                onClick={() => backToRbacTab('tambah')}
                className="mt-4 px-4 py-2 rounded-xl bg-[#06305d] text-white text-xs font-bold cursor-pointer"
              >
                Kembali ke Daftar Pengguna
              </button>
            </div>
          </div>
        );
      }

      const isSelf = targetUser.id === currentUser?.id;
      return renderUserProfileView(targetUser, isSelf, () => backToRbacTab('tambah'), 'ke Tambah Pengguna');
    }

    // --------------------------------------------------------
    // KONDISI 2F: HALAMAN UTAMA MANAJEMEN PENGGUNA RBAC DENGAN TABS
    // --------------------------------------------------------
    const filteredUsers = getFilteredAndSortedUsers();

    return (
      <div className="max-w-4xl mx-auto space-y-5 animate-in fade-in duration-150">
        {/* Tombol Back & Header Ringkas */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={backToMenu}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 shadow-xs transition active:scale-95 cursor-pointer"
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

        <div className="space-y-4">
          {/* Tab Navigasi RBAC: Hanya Teks, Tanpa Icon & Tanpa Notif Angka */}
          <div className="flex p-1 bg-slate-200/80 rounded-2xl gap-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => switchRbacTab('akses')}
              className={`flex-1 py-2.5 px-3 rounded-xl transition-all duration-150 text-center cursor-pointer ${
                rbacTab === 'akses'
                  ? 'bg-white text-[#06305d] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              Pengelolaan Akses
            </button>

            <button
              type="button"
              onClick={() => switchRbacTab('tambah')}
              className={`flex-1 py-2.5 px-3 rounded-xl transition-all duration-150 text-center cursor-pointer ${
                rbacTab === 'tambah'
                  ? 'bg-white text-[#06305d] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              Tambah Pengguna
            </button>
          </div>

          {/* ======================================================== */}
          {/* TAB 1: PENGELOLAAN AKSES (LIST FORMAT NAMA ROLE SAJA)    */}
          {/* ======================================================== */}
          {rbacTab === 'akses' ? (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Header Pengelolaan Akses & Tombol Buat Role Baru */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-slate-900">Pengelolaan Role & Hak Akses (RBAC)</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
                    Kelola peran pengguna dan konfigurasi hak akses modul sistem. Klik salah satu role untuk melihat dan mengedit wewenangnya.
                  </p>
                </div>

                {/* Tombol Buat Role Baru: Membuka Halaman Baru Form Buat Role Baru */}
                <button
                  type="button"
                  onClick={openCreateRolePage}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#06305d] hover:bg-[#0a4583] text-white text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Buat Role Baru</span>
                </button>
              </div>

              {/* LIST ROLE TERDAFTAR: FORMAT HANYA NAMA ROLE SAJA */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
                <div>
                  <h4 className="text-sm font-black text-slate-900">Daftar Role Terdaftar</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Menampilkan {roles.length} role terdaftar. Klik nama role untuk membuka halaman detail.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {roles.map((role) => (
                    <div
                      key={role.id}
                      onClick={() => openRoleDetail(role.id)}
                      className="p-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all duration-150 active:scale-[0.99] cursor-pointer flex items-center justify-between gap-3 group"
                    >
                      {/* Format List: Hanya Menampilkan Nama Role Saja */}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-[#06305d] transition truncate">
                          {role.nama}
                        </p>
                      </div>

                      {/* Indikator Klik untuk Masuk ke Halaman Detail Role */}
                      <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-slate-600 shrink-0">
                        <svg
                          className="w-4 h-4 transition group-hover:translate-x-0.5 duration-150"
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
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /* TAB 2: TAMBAH PENGGUNA                                    */
            /* ======================================================== */
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Notifikasi Sukses */}
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
                    className="text-emerald-700 hover:text-emerald-900 text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Toolbar RBAC: Search, Sort, dan Button Tambah Pengguna */}
              <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
                {/* Search + Sort */}
                <div className="flex items-center gap-2 flex-1 sm:max-w-md">
                  {/* Search */}
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Cari nama pengguna..."
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
                        className="absolute right-2.5 top-2.5 w-4 h-4 rounded-full bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center text-[10px] cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Sort */}
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

                {/* Button Tambah Pengguna: Membuka Halaman Baru Form Data Pengguna */}
                <button
                  type="button"
                  onClick={openAddUserPage}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-[#06305d] hover:bg-[#0a4583] text-white transition shadow-xs active:scale-95 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Tambah Pengguna</span>
                </button>
              </div>

              {/* LIST PENGGUNA TERDAFTAR: HANYA MENAMPILKAN NAMA DAN ROLE */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">List Pengguna Terdaftar</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Menampilkan {filteredUsers.length} akun pengguna
                      {userSearch && <span> untuk pencarian "{userSearch}"</span>}
                    </p>
                  </div>

                  {userSearch && (
                    <button
                      onClick={() => setUserSearch('')}
                      className="text-xs font-bold text-sky-600 hover:text-sky-700 transition cursor-pointer"
                    >
                      Reset
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
                      {userSearch ? `Tidak ada pengguna dengan nama/role "${userSearch}"` : 'Belum ada pengguna terdaftar.'}
                    </p>
                  </div>
                ) : (
                  /* FORMAT LIST: HANYA BERUPA NAMA DAN ROLE SAJA, KLIK UNTUK BUKA PROFIL */
                  <div className="space-y-2.5">
                    {filteredUsers.map((u) => (
                      <div
                        key={u.id}
                        onClick={() => openUserProfile(u.id)}
                        className="p-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all duration-150 active:scale-[0.99] cursor-pointer flex items-center justify-between gap-3 group"
                      >
                        {/* Format List: Hanya Menampilkan Nama */}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-[#06305d] transition truncate">
                            {u.nama}
                          </p>
                        </div>

                        {/* Format List: Hanya Menampilkan Role & Indikator Klik */}
                        <div className="flex items-center gap-2.5 shrink-0">
                          {getRoleBadge(u.role)}
                          <svg
                            className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition group-hover:translate-x-0.5 duration-150"
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
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================================
  // VIEW 3: DETAIL SUBMENU KONTROL KUOTA & PENDAFTARAN ACARA
  // ==========================================================
  if (currentSub === 'kuota') {
    if (currentUser?.role !== 'superadmin') {
      return (
        <div className="max-w-4xl mx-auto space-y-5 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={backToMenu}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 shadow-xs transition active:scale-95 cursor-pointer"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
              </svg>
              <span>Kembali ke Pengaturan</span>
            </button>
          </div>

          <div className="bg-white rounded-3xl p-8 border border-amber-200 shadow-xs text-center max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-200">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-base font-black text-slate-800 mb-1">Akses Terbatas: Khusus Superadmin</h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Akun Anda memiliki role <strong className="text-slate-800">{currentUser?.role}</strong>. Menu kontrol kuota dan penutupan pendaftaran peserta hanya dapat diakses oleh Superadmin.
            </p>
            <button
              onClick={backToMenu}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
            >
              Kembali ke Menu Pengaturan
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-150">
        {/* Tombol Back & Badge Hak Akses */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={backToMenu}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 shadow-xs transition active:scale-95 cursor-pointer"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
            <span>Kembali ke Pengaturan</span>
          </button>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-700 border border-purple-200">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            Akses Eksklusif Superadmin
          </span>
        </div>

        {/* Header Modul */}
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Kontrol Kuota & Pendaftaran Acara
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Kelola ketersediaan pendaftaran peserta secara langsung. Saat kuota ditutup, tombol "Daftar Sekarang" di portal peserta akan dinonaktifkan dan teks kuota berubah menjadi "Ditutup".
          </p>
        </div>

        {/* Feedback Alert */}
        {kuotaFeedback && (
          <div
            className={`p-4 rounded-2xl border text-xs flex items-start gap-3 transition ${
              kuotaFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <span className="text-base">{kuotaFeedback.type === 'success' ? '✅' : '⚠️'}</span>
            <div className="flex-1 font-semibold">{kuotaFeedback.message}</div>
          </div>
        )}

        {/* Card Status & Kontrol Utama */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Status Saat Ini
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-black ${
                    pendaftaranBuka
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      pendaftaranBuka ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                    }`}
                  />
                  <span>{pendaftaranBuka ? 'KUOTA ACARA TERBUKA' : 'KUOTA ACARA DITUTUP'}</span>
                </span>
                {loadingKuota && (
                  <span className="text-xs text-slate-400 animate-pulse">Memuat...</span>
                )}
              </div>
            </div>

            {/* Tombol Aksi Toggle */}
            <button
              type="button"
              disabled={savingKuota || loadingKuota}
              onClick={() => handleToggleKuota(!pendaftaranBuka)}
              className={`px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold shadow-md transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                pendaftaranBuka
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
              }`}
            >
              {savingKuota ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menyimpan Perubahan...</span>
                </>
              ) : pendaftaranBuka ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  <span>Tutup Kuota Pendaftaran</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Buka Kuota Pendaftaran</span>
                </>
              )}
            </button>
          </div>

          {/* Rincian Efek di Portal Peserta */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <span>👥</span>
                <span>Teks Kartu Kuota Peserta</span>
              </div>
              <div className="text-base font-extrabold text-slate-900">
                {pendaftaranBuka ? 'Terbuka' : 'Ditutup'}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Teks pada card Kuota Acara di beranda portal peserta disesuaikan otomatis secara real-time.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <span>🔘</span>
                <span>Tombol CTA Pendaftaran</span>
              </div>
              <div className="text-base font-extrabold text-slate-900">
                {pendaftaranBuka ? 'Daftar Sekarang (Aktif)' : 'Kuota Acara Ditutup (Nonaktif)'}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Saat ditutup, tombol pendaftaran dikunci dan peserta tidak dapat mengirim formulir pendaftaran baru.
              </p>
            </div>
          </div>

          {/* Simulasi Tampilan Portal Peserta (Live Preview Box) */}
          <div className="pt-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Pratinjau Langsung Sisi Peserta (Live Preview)
            </div>
            <div className="rounded-2xl bg-gradient-to-r from-[#06305d] to-[#08407c] p-5 text-white space-y-4">
              <div className="flex items-center justify-between text-xs text-sky-200 border-b border-white/10 pb-2">
                <span>Tampilan Beranda Peserta</span>
                <span className="font-mono text-[10px]">ms-evenscan-peserta</span>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-sm">
                {/* Preview Stat Card */}
                <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3">
                  <div className="text-[10px] text-sky-200 font-medium">👥 KUOTA ACARA</div>
                  <div className={`text-lg font-black ${pendaftaranBuka ? 'text-white' : 'text-amber-300'}`}>
                    {pendaftaranBuka ? 'Terbuka' : 'Ditutup'}
                  </div>
                </div>

                {/* Preview CTA Button */}
                <div className="flex items-center">
                  <div
                    className={`w-full text-center font-bold px-3 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition ${
                      pendaftaranBuka
                        ? 'bg-white text-[#07407b] shadow-md'
                        : 'bg-white/20 text-white/60 border border-white/15 cursor-not-allowed'
                    }`}
                  >
                    <span>{pendaftaranBuka ? 'Daftar Sekarang' : 'Kuota Acara Ditutup'}</span>
                    <span>{pendaftaranBuka ? '→' : '🔒'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {kuotaUpdatedAt && (
            <div className="text-[11px] text-slate-400 text-right pt-2">
              Terakhir diperbarui: {new Date(kuotaUpdatedAt).toLocaleString('id-ID')}
            </div>
          )}
        </div>
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

        {/* TOMBOL KELUAR */}
        <div className="pt-3">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold shadow-xs transition duration-150 active:scale-98 cursor-pointer"
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
