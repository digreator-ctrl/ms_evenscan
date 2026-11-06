-- Migrasi: melacak petugas yang melakukan ACC & mengirim konfirmasi WhatsApp
ALTER TABLE pendaftar ADD COLUMN confirmed_by TEXT;
ALTER TABLE pendaftar ADD COLUMN wa_sent_by TEXT;
