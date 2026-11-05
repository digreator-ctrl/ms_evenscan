import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface Stats {
  total: number;
  menunggu: number;
  dikonfirmasi: number;
  hadir: number;
  ditolak: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, menunggu: 0, dikonfirmasi: 0, hadir: 0, ditolak: 0 });

  useEffect(() => {
    // TODO: Fetch actual stats from API
    // For now using placeholder
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/absensi/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const cards = [
    { label: 'Total Pendaftar', value: stats.total, icon: '👥', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: 'Menunggu', value: stats.menunggu, icon: '⏳', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    { label: 'Dikonfirmasi', value: stats.dikonfirmasi, icon: '✅', color: 'bg-green-50 text-green-700 border-green-200' },
    { label: 'Sudah Hadir', value: stats.hadir, icon: '🎉', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    { label: 'Ditolak', value: stats.ditolak, icon: '❌', color: 'bg-red-50 text-red-700 border-red-200' },
  ];

  const hasilPersentase = stats.total > 0
    ? Math.round((stats.hadir / stats.dikonfirmasi) * 100) || 0
    : 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 mb-8">
        {cards.map((card, idx) => (
          <div
            key={card.label}
            className={`rounded-xl border p-4 sm:p-5 ${card.color} ${
              idx === 0 ? 'col-span-2 md:col-span-1' : ''
            }`}
          >
            <div className="text-2xl mb-1.5">{card.icon}</div>
            <div className="text-2xl sm:text-3xl font-bold">{card.value}</div>
            <div className="text-xs sm:text-sm mt-1 opacity-75 font-medium">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Progres Kehadiran</h2>
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-gray-200 rounded-full h-4">
            <div
              className="bg-primary-500 rounded-full h-4 transition-all duration-500"
              style={{ width: `${hasilPersentase}%` }}
            ></div>
          </div>
          <span className="text-lg font-bold text-primary-700">{hasilPersentase}%</span>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          {stats.hadir} dari {stats.dikonfirmasi} peserta yang dikonfirmasi sudah hadir
        </p>
      </div>
    </div>
  );
}
