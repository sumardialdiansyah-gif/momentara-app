# MOMENTARA — Aplikasi Publik (dalam pembangunan)

Tahap 1 lanjutan: aplikasi publik yang bisa dipakai customer dan tamu dari luar, BUKAN situs statis informasi.
Situs statis: https://momentara-public.vercel.app
Supabase: proyek momentara, organisasi MOMENTARA, https://supabase.com/dashboard/project/zhdktpywesnpthqpxjog
Database: 10 tabel sudah dibuat, seed plans/settings sudah terisi, bucket event-photos (privat) dan event-covers (publik) sudah dibuat.

## Status saat ini
- Fondasi database: SELESAI.
- Seed + bucket: SELESAI.
- Aplikasi publik: DALAM PEMBANGUNAN — kerangka dan konfigurasi disiapkan di turn ini, deployment menyusul setelah anon key dan kebijakan akses tamu terverifikasi.
- Payment gateway produksi: BELUM (tahap berikutnya).
- Harga final dan Privasi/Syarat final: BELUM (tahap berikutnya).

## Yang masih dibutuhkan sebelum deploy
1. Supabase anon key (kunci publik klien, bukan service role key) dari Settings > API proyek momentara.
2. Kebijakan RLS tambahan untuk akses tamu berdasarkan kode/token acara, karena RLS awal hanya mengizinkan owner.
   File: ~/workspace/momentara-deployment/guest-access-rls.sql (disiapkan, belum dijalankan).
3. Konfirmasi bahwa anon key sudah dimasukkan ke config.js, bukan service role key.

## Keamanan
- JANGAN pernah memasukkan service role key ke frontend.
- Admin hanya berdasarkan profiles.role = 'admin' di server, bukan parameter browser.
- Pembayaran masih sandbox/manual sampai gateway produksi terverifikasi.
