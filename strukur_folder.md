Struktur folder ini dirancang menggunakan arsitektur *monorepo* yang memisahkan *backend* API, antarmuka peserta, dan dasbor admin panitia agar beroperasi secara independen di ekosistem Cloudflare.

```text
proyek-pendaftaran-acara/
├── backend/                          (Cloudflare Workers - Logika API dengan Hono)
│   ├── src/
│   │   ├── index.ts                  (Titik masuk utama aplikasi API)
│   │   ├── db/                       (Skema Cloudflare D1 untuk menyimpan data pendaftar)
│   │   ├── routes/
│   │   │   ├── peserta.ts            (Endpoint penerima biodata & upload screenshot)
│   │   │   ├── admin.ts              (Endpoint konfirmasi persetujuan panitia)
│   │   │   └── absensi.ts            (Endpoint validasi saat QR code di-scan)
│   │   ├── services/
│   │   │   ├── storage.ts            (Integrasi Cloudflare R2 untuk menyimpan screenshot)
│   │   │   ├── qr-generator.ts       (Pembuat QR code unik per peserta)
│   │   │   └── whatsapp.ts           (Integrasi API WhatsApp untuk pengiriman QR)
│   │   └── middlewares/              (Lapisan keamanan & autentikasi untuk admin)
│   └── wrangler.toml                 (Konfigurasi deployment backend ke Worker)
└── frontend/
    ├── peserta/                      (Cloudflare Pages - Aplikasi Peserta dengan Astro JS)
    │   ├── src/
    │   │   ├── pages/
    │   │   │   ├── index.astro       (Halaman muka atau info acara)
    │   │   │   ├── daftar.astro      (Formulir input data diri & tombol upload)
    │   │   │   └── sukses.astro      (Pesan pendaftaran sedang diproses)
    │   │   └── components/           (Komponen UI seperti Tailwind/Shadcn)
    │   └── package.json
    └── admin/                        (Cloudflare Pages - Dasbor Panitia dengan Refine)
        ├── src/
        │   ├── pages/
        │   │   ├── login.tsx         (Halaman akses masuk khusus panitia)
        │   │   ├── verifikasi.tsx    (Tabel daftar tunggu, cek screenshot, dan tombol ACC)
        │   │   └── scanner.tsx       (Modul kamera pembaca QR code untuk absensi)
        │   └── components/
        └── package.json

```

**Alur Pendaftaran Peserta**

* Peserta membuka `frontend/peserta/src/pages/daftar.astro` untuk melengkapi form dan foto.
* Antarmuka mengirim data tersebut ke `backend/src/routes/peserta.ts` untuk dicatat ke database, sementara file gambar masuk ke modul `storage.ts`.

**Alur Konfirmasi & Pengiriman QR**

* Panitia mengakses `frontend/admin/src/pages/verifikasi.tsx` (yang di-hosting pada subdomain khusus) untuk meninjau data masuk.
* Saat panitia menekan tombol konfirmasi, instruksi dikirim ke *backend* yang kemudian mencetak kode melalui `qr-generator.ts`.
* Skrip `whatsapp.ts` mengambil alih untuk meneruskan gambar QR tersebut ke nomor HP pendaftar secara otomatis.

**Alur Kehadiran di Lokasi**

* Panitia yang bertugas di pintu masuk membuka halaman `frontend/admin/src/pages/scanner.tsx` menggunakan peramban HP.
* Sistem memindai QR, lalu mengirimkan token ke `backend/src/routes/absensi.ts` untuk mengubah status kehadiran peserta di database secara seketika.