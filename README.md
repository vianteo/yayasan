# Yayasan Bina Tali Kasih

Aplikasi web administrasi Yayasan Bina Tali Kasih berbasis Google Apps Script. Aplikasi menyediakan portal publik dan dashboard internal untuk pengelolaan program, peserta, penerima manfaat, donasi uang/barang, penyaluran, publikasi, persetujuan, dan pengawasan.

## Arsitektur

- Google Apps Script V8 + HTML Service
- Google Sheets sebagai database
- Google Drive untuk dokumen dan backup
- Email untuk kode login dan notifikasi
- Firebase Hosting sebagai URL masuk gratis melalui redirect HTTPS
- GitHub Actions + clasp untuk deployment berversi

Data, ID Google Drive/Sheets, rekening, dan kredensial tidak disimpan dalam repository.

## Pengembangan

```bash
npm ci
npm test
```

Spesifikasi yang disetujui tersedia di `spec/app-spec.md`.

## Penyiapan Apps Script

Setelah branch tersedia di GitHub, buka Codespace pada branch aplikasi dan jalankan:

```bash
npm run setup:apps-script
```

Script akan memandu login GitHub dan Google, membuat proyek Apps Script, lalu mengisi dua nama secret GitHub Actions tanpa menampilkan nilainya.

## Script Properties

- `PRIMARY_SPREADSHEET_ID`
- `DOCUMENTS_DRIVE_FOLDER_ID`
- `BACKUP_DRIVE_FOLDER_ID`
- `SESSION_SIGNING_KEY`
- `PUBLIC_APP_URL`
- `INTERNAL_APP_URL`
- `LARGE_TRANSACTION_THRESHOLD_IDR`

Jalankan `setupProject()` satu kali dari editor Apps Script setelah mengisi Script Properties.

## URL sederhana dengan Firebase Hosting

Firebase Hosting hanya menjadi pintu masuk. Aplikasi, login OTP, Google Sheets, dan Google Drive tetap berjalan di Apps Script.

Setelah perubahan ini masuk ke `main`, buka Codespace pada branch `main`, lalu jalankan:

```bash
npm ci --no-audit --no-fund
npm run setup:firebase-hosting
```

Skrip menggunakan ID proyek yang direkomendasikan `yayasan-bina-tali-kasih`, memandu login Firebase, membuat proyek bila belum ada, lalu menerbitkan Hosting. Jangan kirim kode login atau kredensial Firebase melalui chat.

Jika ID tersebut sudah digunakan secara global, jalankan ulang dengan alternatif yang diinformasikan oleh skrip:

```bash
npm run setup:firebase-hosting -- yayasan-bina-tali-kasih-id
```

Setelah berhasil, URL yang dibagikan adalah:

- `https://PROJECT_ID.web.app` untuk portal publik.
- `https://PROJECT_ID.web.app/pengurus` untuk portal internal.

Karena metode yang dipakai adalah redirect aman, bilah alamat browser akan berpindah ke URL Apps Script setelah halaman dibuka. Setelah Hosting aktif, ubah Script Properties `PUBLIC_APP_URL` dan `INTERNAL_APP_URL` ke dua URL Firebase tersebut.
