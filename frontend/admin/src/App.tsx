import { Refine } from '@refinedev/core';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import dataProvider from '@refinedev/simple-rest';
import { Login } from './pages/login';
import { Verifikasi } from './pages/verifikasi';
import { Scanner } from './pages/scanner';
import { Dashboard } from './pages/dashboard';
import { RiwayatScan } from './pages/riwayat-scan';
import { RiwayatDetail } from './pages/riwayat-detail';
import { Pengaturan } from './pages/pengaturan';
import { Layout } from './components/Layout';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

function App() {
  return (
    <BrowserRouter>
      <Refine
        dataProvider={dataProvider(API_URL)}
        resources={[
          {
            name: 'pendaftar',
            list: '/verifikasi',
          },
        ]}
      >
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/riwayat-scan" element={<RiwayatScan />} />
            <Route path="/riwayat-scan/:id" element={<RiwayatDetail />} />
            <Route path="/verifikasi" element={<Verifikasi />} />
            <Route path="/scanner" element={<Scanner />} />
            <Route path="/pengaturan" element={<Pengaturan />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Refine>
    </BrowserRouter>
  );
}

export default App;
