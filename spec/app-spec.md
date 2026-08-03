# Spesifikasi Aplikasi V1

## 1. Business outcome and users

Menyatukan administrasi program, peserta/penerima manfaat, donasi, penyaluran, bukti, persetujuan, dan laporan Yayasan Bina Tali Kasih. Portal publik hanya menampilkan informasi yang telah disetujui dan data agregat.

## 2. Project type and architecture

Web app baru menggunakan Google Apps Script V8, HTML Service, Google Sheets, Google Drive, dan email. Satu proyek menyediakan portal publik dan portal internal terautentikasi.

## 3. Roles and access control

- Pembina: laporan, program/anggaran tahunan, pertanggungjawaban.
- Pengawas: akses pemeriksaan, catatan, audit, dan transaksi khusus.
- Ketua: persetujuan pengeluaran, program, dan publikasi.
- Wakil Ketua: pemantauan dan delegasi resmi.
- Sekretaris: program, kegiatan, peserta, penerima manfaat, konten.
- Bendahara: donatur, donasi, pengeluaran, penyaluran, bukti.
- Admin: pengguna, peran, master data, dan pengaturan. Modul `Kelola Pengguna` hanya tampil untuk Admin dan menyediakan tambah, ubah, aktivasi, serta nonaktivasi tanpa hapus permanen.
- Publik: data yang telah diterbitkan saja.

Semua otorisasi diperiksa di server. Login internal menggunakan kode sekali pakai ke alamat Gmail yang terdapat pada allowlist `USERS`.

## 4. Workflows and prioritized features

V1 mencakup program/kegiatan, peserta, penerima manfaat, donasi uang/barang, pengeluaran/penyaluran, persetujuan, publikasi, laporan, audit, backup, dan pengelolaan akses pengguna oleh Admin. Semua pengeluaran disetujui ketua; transaksi besar/tidak biasa diperiksa pengawas. Publikasi dibuat sekretaris dan disetujui ketua. Form relasional menggunakan pilihan berlabel untuk program, donatur, donasi, dan publikasi; pengguna tidak perlu mengetik ID teknis.

## 5. Entity/data model and selected store

Google Sheets dipilih untuk volume awal di bawah 5.000 catatan. Entitas: users, programs, activities, participants, beneficiaries, donors, donations, donation items, disbursements, approvals, publications, media, audit log, settings, dan backup log. Data disimpan berkelanjutan dengan backup berkala. Relasi disimpan menggunakan ID stabil, tetapi UI menampilkan nama/nomor referensi beserta ID. ID dibuat otomatis dengan awalan berbeda per entitas (`PRG`, `KGT`, `PST`, `PMF`, `DNR`, `DNS`, `DBR`, `PNY`, `PUB`, `MED`) dan hanya ditampilkan sebagai informasi saat mengubah data. ID lama tetap dipertahankan.

## 6. Integrations, triggers, and notifications

Sheets, Drive, Mail, backup terjadwal, ringkasan bulanan, dan pengingat persetujuan. Notifikasi bersifat idempoten.

## 7. UI and accessibility

Portal publik: beranda, profil, struktur, program, berita, galeri, laporan ringkas, donasi, kontak. Portal internal: dashboard dan modul administrasi, termasuk menu `Kelola Pengguna` khusus Admin. Form internal menampilkan dropdown relasional yang mudah dipahami, opsi kosong untuk relasi opsional, serta penjelasan bahwa ID dibuat otomatis. Bahasa Indonesia, responsif, ramah keyboard, berlabel, dan memiliki status loading/kosong/gagal/berhasil.

## 8. OAuth scopes and advanced services

Scopes eksplisit untuk Sheets, Drive, pengiriman email, dan trigger. Tidak menggunakan Admin SDK atau layanan istimewa.

## 9. Required Script Properties, names only

`PRIMARY_SPREADSHEET_ID`, `DOCUMENTS_DRIVE_FOLDER_ID`, `BACKUP_DRIVE_FOLDER_ID`, `SESSION_SIGNING_KEY`, `PUBLIC_APP_URL`, `INTERNAL_APP_URL`, `LARGE_TRANSACTION_THRESHOLD_IDR`.

## 10. Quota, privacy, admin, and operational risks

Risiko utama: kuota email/eksekusi, konkurensi Sheets, kepemilikan akun, kebocoran data pribadi, publikasi foto anak, dan pemulihan backup. LockService, audit append-only, pembatasan akses, redaksi publik, serta backup digunakan sebagai kontrol.

## 11. Testable acceptance criteria

Sistem menolak input tidak valid dan akses salah peran; mencegah duplikasi; mencatat seluruh keputusan; mewajibkan pengawas untuk transaksi khusus; menjaga data pribadi dari portal publik; menangani kegagalan Mail/Drive tanpa menandai proses selesai; dan mendukung pemulihan backup. Pengelolaan pengguna harus menolak email duplikat, peran/status yang tidak valid, upaya Admin menonaktifkan atau menurunkan perannya sendiri, serta perubahan yang menyebabkan tidak ada Admin aktif. Setiap perubahan pengguna dicatat pada Audit Log. Server menolak ID relasi yang tidak ditemukan atau sudah tidak aktif, tetapi tetap mengizinkan data lama mempertahankan relasi lama yang sama saat diedit. Data yang diarsipkan tidak tersedia sebagai pilihan baru.

## 12. Manual setup and out-of-scope items

Manual: akun pemilik, Sheets/folder Drive, pengguna Admin pertama, batas transaksi, rekening/kontak resmi, Script Properties, OAuth, branding, dan penyesuaian AD/ART. Pengguna berikutnya dikelola melalui portal oleh Admin. Di luar V1: payment gateway, formulir publik, portal donatur, WhatsApp API, payroll/karyawan, akuntansi bank, aplikasi seluler, multi-yayasan, dan Marketplace.

Disetujui oleh pengguna pada 3 Agustus 2026.

Perubahan modul pengelolaan pengguna disetujui oleh pengguna pada 3 Agustus 2026.

Perubahan dropdown relasional dan validasi referensi disetujui oleh pengguna pada 3 Agustus 2026.
