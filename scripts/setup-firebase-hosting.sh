#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

project_id="${1:-yayasan-bina-tali-kasih}"
display_name="Yayasan Bina Tali Kasih"
export FIREBASE_CLI_DISABLE_UPDATE_CHECK=1

if [[ ! "$project_id" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]]; then
  echo "Project ID tidak valid. Gunakan 6-30 karakter: huruf kecil, angka, dan tanda hubung." >&2
  exit 1
fi

command -v node >/dev/null || { echo "Node.js tidak tersedia." >&2; exit 1; }
command -v npm >/dev/null || { echo "npm tidak tersedia." >&2; exit 1; }

firebase_cli_dir="$repo_root/.firebase-cli"
firebase_binary="$firebase_cli_dir/node_modules/.bin/firebase"
if [[ ! -x "$firebase_binary" ]]; then
  echo "Menyiapkan Firebase CLI 15.25.1 pada direktori lokal yang diabaikan Git."
  mkdir -p "$firebase_cli_dir"
  npm install --prefix "$firebase_cli_dir" --no-save --ignore-scripts --no-audit --no-fund firebase-tools@15.25.1
fi

firebase_version="$($firebase_binary --version)"
if [[ "$firebase_version" != "15.25.1" ]]; then
  echo "Versi Firebase CLI harus 15.25.1; ditemukan $firebase_version." >&2
  exit 1
fi

if ! "$firebase_binary" projects:list --json >/dev/null 2>&1; then
  echo "Login Firebase diperlukan. Selesaikan login hanya melalui terminal ini."
  "$firebase_binary" login --no-localhost
fi

if ! projects_json="$($firebase_binary projects:list --json)"; then
  echo "Daftar proyek Firebase tidak dapat dibaca. Periksa akun dan izin, lalu coba kembali." >&2
  exit 1
fi

if ! printf '%s' "$projects_json" | node -e '
  let input="";
  process.stdin.on("data", chunk => input += chunk);
  process.stdin.on("end", () => {
    const wanted = process.argv[1];
    const parsed = JSON.parse(input);
    const projects = parsed.result || parsed.projects || [];
    process.exit(projects.some(project => project.projectId === wanted) ? 0 : 1);
  });
' "$project_id"; then
  echo "Membuat proyek Firebase: $project_id"
  if ! "$firebase_binary" projects:create "$project_id" --display-name "$display_name"; then
    echo "Project ID '$project_id' mungkin sudah digunakan secara global atau akun tidak memiliki izin." >&2
    echo "Coba alternatif, misalnya: npm run setup:firebase-hosting -- yayasan-bina-tali-kasih-id" >&2
    exit 1
  fi
fi

node scripts/validate-firebase-hosting.mjs
node scripts/deploy-firebase-hosting.mjs "$project_id"

echo "Firebase Hosting selesai."
echo "Portal publik  : https://$project_id.web.app"
echo "Portal pengurus: https://$project_id.web.app/pengurus"
echo "Selanjutnya isi PUBLIC_APP_URL dan INTERNAL_APP_URL dengan dua URL tersebut pada Script Properties."
