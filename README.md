# Yayasan Bina Tali Kasih

Aplikasi web administrasi Yayasan Bina Tali Kasih berbasis Google Apps Script. Aplikasi menyediakan portal publik dan dashboard internal untuk pengelolaan program, peserta, penerima manfaat, donasi uang/barang, penyaluran, publikasi, persetujuan, dan pengawasan.

## Arsitektur

- Google Apps Script V8 + HTML Service
- Google Sheets sebagai database
- Google Drive untuk dokumen dan backup
- Email untuk kode login dan notifikasi
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
