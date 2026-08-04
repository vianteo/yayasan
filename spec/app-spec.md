# Spesifikasi Aplikasi V1

## 1. Business outcome and users

Menyatukan administrasi program, peserta/penerima manfaat, donasi, penyaluran, bukti, persetujuan, dan laporan Yayasan Bina Tali Kasih. Portal publik hanya menampilkan informasi yang telah disetujui dan data agregat.

## 2. Project type and architecture

Web app menggunakan Google Apps Script V8, HTML Service, Google Sheets, Google Drive, dan email. Satu proyek menyediakan portal publik dan portal internal terautentikasi. Firebase Hosting menyediakan URL masuk gratis `PROJECT_ID.web.app` melalui redirect HTTPS; Apps Script tetap menjadi runtime aplikasi dan alamat browser berpindah ke domain Apps Script setelah redirect.

## 3. Roles and access control

- Pembina: laporan, program/anggaran tahunan, pertanggungjawaban.
- Pengawas: akses pemeriksaan, catatan, audit, dan transaksi khusus.
- Ketua: persetujuan pengeluaran, program, dan publikasi.
- Wakil Ketua: pemantauan dan delegasi resmi.
- Sekretaris: program, kegiatan, peserta, penerima manfaat, konten.
- Bendahara: donatur, donasi, pengeluaran, penyaluran, bukti.
- Staf Program: pekerja/pelaksana di luar pengurus inti. Hanya melihat Program yang ditugaskan; akses `VIEW` bersifat baca-saja, sedangkan `EDIT` dapat menambah dan mengubah kegiatan, peserta, penerima manfaat, serta publikasi DRAFT pada Program tersebut. Staf tidak dapat mengakses keuangan, pengguna, audit, persetujuan, atau mengarsipkan data.
- Admin: pengguna, peran, master data, dan pengaturan. Modul `Kelola Pengguna` hanya tampil untuk Admin dan menyediakan tambah, ubah, aktivasi, serta nonaktivasi tanpa hapus permanen.
- Publik: data yang telah diterbitkan saja.

Semua otorisasi diperiksa di server. Login internal menggunakan kode sekali pakai ke alamat Gmail yang terdapat pada allowlist `USERS`.

## 4. Workflows and prioritized features

V1 mencakup program/kegiatan, peserta, penerima manfaat, donasi uang/barang, pengeluaran/penyaluran, persetujuan, publikasi, laporan, audit, backup, dan pengelolaan akses pengguna oleh Admin. Semua pengeluaran disetujui ketua; transaksi besar/tidak biasa diperiksa pengawas. Publikasi dibuat sekretaris dan disetujui ketua. Admin menugaskan Staf Program ke satu atau beberapa Program dengan tingkat akses `VIEW`/`EDIT`, tanggal mulai, tanggal berakhir opsional, dan status aktif. Staf dengan `EDIT` mengajukan perubahan data induk Program melalui usulan; Sekretaris, Ketua, atau Admin harus menyetujui atau menolaknya sebelum perubahan diterapkan. Form relasional menggunakan pilihan berlabel untuk program, donatur, donasi, dan publikasi; pengguna tidak perlu mengetik ID teknis. Bukti penerimaan donasi, pengeluaran, penyaluran barang, dan gambar publikasi diunggah langsung melalui portal.

## 5. Entity/data model and selected store

Google Sheets dipilih untuk volume awal di bawah 5.000 catatan. Entitas: users, user program access, program change requests, programs, activities, participants, beneficiaries, donors, donations, donation items, disbursements, approvals, publications, media, audit log, settings, dan backup log. Data disimpan berkelanjutan dengan backup berkala. Relasi disimpan menggunakan ID stabil, tetapi UI menampilkan nama/nomor referensi beserta ID. ID dibuat otomatis dengan awalan berbeda per entitas (`USR`, `ACC`, `PCR`, `PRG`, `KGT`, `PST`, `PMF`, `DNR`, `DNS`, `DBR`, `PNY`, `PUB`, `MED`) dan hanya ditampilkan sebagai informasi saat mengubah data. ID lama tetap dipertahankan. File bukti disimpan privat di folder Drive dokumen; Sheets hanya menyimpan URL file.

## 6. Integrations, triggers, and notifications

Sheets, Drive, Mail, Firebase Hosting, backup terjadwal, ringkasan bulanan, dan pengingat persetujuan. Notifikasi bersifat idempoten. Unggahan menerima JPG/PNG/PDF maksimal 5 MB; gambar sampul hanya menerima JPG/PNG. Nama file dibuat otomatis menggunakan waktu, entitas, dan ID catatan. Rute Firebase `/` mengarah ke portal publik, sedangkan `/pengurus` mengarah ke portal internal.

## 7. UI and accessibility

Portal publik: beranda, profil, struktur, program, berita, galeri, laporan ringkas, donasi, kontak. Portal internal: dashboard dan modul administrasi, termasuk menu `Kelola Pengguna` dan `Akses Staf` khusus Admin serta menu `Usulan Program` untuk Staf Program dan pemeriksa. Portal staf hanya menampilkan Program, Kegiatan, Peserta, Penerima Manfaat, dan Publikasi sesuai penugasan; UI juga menyembunyikan tindakan yang tidak diizinkan oleh tingkat aksesnya. Form internal menampilkan dropdown relasional yang mudah dipahami, opsi kosong untuk relasi opsional, penjelasan bahwa ID dibuat otomatis, input unggah file, serta tombol `Lihat bukti`. File privat ditampilkan melalui respons terautentikasi tanpa membagikan folder Drive kepada pengguna. Bahasa Indonesia, responsif, ramah keyboard, berlabel, dan memiliki status loading/kosong/gagal/berhasil.

## 8. OAuth scopes and advanced services

Scopes eksplisit untuk Sheets, Drive, pengiriman email, dan trigger. Tidak menggunakan Admin SDK atau layanan istimewa.

## 9. Required Script Properties, names only

`PRIMARY_SPREADSHEET_ID`, `DOCUMENTS_DRIVE_FOLDER_ID`, `BACKUP_DRIVE_FOLDER_ID`, `SESSION_SIGNING_KEY`, `PUBLIC_APP_URL`, `INTERNAL_APP_URL`, `LARGE_TRANSACTION_THRESHOLD_IDR`.

## 10. Quota, privacy, admin, and operational risks

Risiko utama: kuota email/eksekusi, konkurensi Sheets, kepemilikan akun, kebocoran data pribadi, publikasi foto anak, unggahan file berbahaya/terlalu besar, kapasitas Drive, pemulihan backup, serta nama proyek Firebase yang bersifat unik global. LockService, audit append-only, pembatasan akses, redaksi publik, validasi signature file dan ukuran, folder Drive privat, backup, dan redirect sementara HTTP 302 digunakan sebagai kontrol. Hosting tidak memakai iframe sehingga Apps Script tidak perlu membuka perlindungan `X-Frame-Options`.

## 11. Testable acceptance criteria

Sistem menolak input tidak valid dan akses salah peran; mencegah duplikasi; mencatat seluruh keputusan; mewajibkan pengawas untuk transaksi khusus; menjaga data pribadi dari portal publik; menangani kegagalan Mail/Drive tanpa menandai proses selesai; dan mendukung pemulihan backup. Pengelolaan pengguna harus menolak email duplikat, peran/status yang tidak valid, upaya Admin menonaktifkan atau menurunkan perannya sendiri, serta perubahan yang menyebabkan tidak ada Admin aktif. Setiap perubahan pengguna dicatat pada Audit Log. Server membatasi setiap pembacaan dan perubahan oleh Staf Program berdasarkan penugasan yang aktif pada tanggal berjalan; `VIEW` tidak dapat menulis, `EDIT` tidak dapat mengubah data di Program lain, Staf tidak dapat mengarsipkan, dan publikasi di luar status DRAFT tidak dapat diubah oleh Staf. Usulan Program hanya menyimpan kolom yang berubah, hanya dapat diputuskan sekali, dan keputusan dicatat pada Approval serta Audit Log. Server menolak ID relasi yang tidak ditemukan atau sudah tidak aktif, tetapi tetap mengizinkan data lama mempertahankan relasi lama yang sama saat diedit. Data yang diarsipkan tidak tersedia sebagai pilihan baru. Unggahan menolak file kosong, lebih dari 5 MB, format terlarang, dan MIME yang tidak sesuai signature. Kegagalan penyimpanan catatan membuang file baru yang belum terhubung; unggah/penggantian dicatat di Audit Log. Tautan bukti tidak dapat diubah melalui API simpan biasa.

## 12. Manual setup and out-of-scope items

Manual: akun pemilik, Sheets/folder Drive, pengguna Admin pertama, batas transaksi, rekening/kontak resmi, Script Properties, OAuth, branding, penyesuaian AD/ART, login Firebase CLI satu kali, dan deployment Hosting pertama. Pengguna berikutnya dan penugasan Staf Program dikelola melalui portal oleh Admin. Sheet `USER_PROGRAM_ACCESS` dan `PROGRAM_CHANGE_REQUESTS` dibuat otomatis saat fitur pertama kali dipakai; tidak ada Script Property atau OAuth scope baru. Nilai `PUBLIC_APP_URL` dan `INTERNAL_APP_URL` diperbarui ke URL Firebase setelah Hosting aktif. Di luar V1: custom domain berbayar, reverse proxy Firebase ke Apps Script, iframe portal, payment gateway, formulir publik, portal donatur, WhatsApp API, payroll/akuntansi gaji, akuntansi bank, aplikasi seluler, multi-yayasan, dan Marketplace.

Disetujui oleh pengguna pada 3 Agustus 2026.

Perubahan modul pengelolaan pengguna disetujui oleh pengguna pada 3 Agustus 2026.

Perubahan dropdown relasional dan validasi referensi disetujui oleh pengguna pada 3 Agustus 2026.

Perubahan unggah dan tampilan bukti melalui portal disetujui oleh pengguna pada 3 Agustus 2026.

Perubahan akses Staf Program berbasis penugasan Program disetujui oleh pengguna pada 4 Agustus 2026.

Perubahan URL masuk gratis menggunakan redirect Firebase Hosting disetujui oleh pengguna pada 4 Agustus 2026.
