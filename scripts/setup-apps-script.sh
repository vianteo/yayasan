#!/usr/bin/env bash
set -euo pipefail

EXPECTED_REPO='vianteo/yayasan'
EXPECTED_BRANCH='chatgpt/yayasan-bina-tali-kasih-v1'
APP_TITLE='Yayasan Bina Tali Kasih'
CLASP_TYPE='standalone'
STATE_DIR="$HOME/.config/ybtk-apps-script"
STATE_FILE="$STATE_DIR/.clasp.json"
REPO_ROOT="$(git rev-parse --show-toplevel)"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf -- "$TEMP_DIR"' EXIT

gh_user() {
  env -u GH_TOKEN -u GITHUB_TOKEN gh "$@"
}

[[ "${CODESPACES:-}" == 'true' ]] || { echo 'Jalankan script ini di GitHub Codespaces.' >&2; exit 1; }
for command_name in gh node npm git; do command -v "$command_name" >/dev/null || { echo "Perintah wajib tidak tersedia: $command_name" >&2; exit 1; }; done

if ! gh_user auth status >/dev/null 2>&1; then
  gh_user auth login --web --scopes repo,workflow
fi
RESOLVED_REPO="$(gh_user repo view "$EXPECTED_REPO" --json nameWithOwner --jq .nameWithOwner)"
[[ "$RESOLVED_REPO" == "$EXPECTED_REPO" ]] || { echo 'Repository GitHub tidak sesuai.' >&2; exit 1; }
if ! gh_user api --silent "repos/$EXPECTED_REPO/actions/secrets/public-key"; then
  echo 'Izin untuk mengelola Actions secrets belum tersedia. Login ulang GitHub.' >&2
  gh_user auth refresh --scopes repo,workflow
  gh_user api --silent "repos/$EXPECTED_REPO/actions/secrets/public-key" || { echo 'Pemeriksaan izin Actions secrets tetap gagal.' >&2; exit 1; }
fi

CURRENT_BRANCH="$(git branch --show-current)"
[[ "$CURRENT_BRANCH" == "$EXPECTED_BRANCH" ]] || { echo "Branch harus $EXPECTED_BRANCH, saat ini $CURRENT_BRANCH" >&2; exit 1; }
if git ls-files | grep -E '(^|/)(\.clasp\.json|\.clasprc\.json|client_secret.*\.json|.*oauth.*client.*\.json)$' >/dev/null; then
  echo 'File kredensial terdeteksi dalam repository. Hapus sebelum melanjutkan.' >&2
  exit 1
fi

cd "$REPO_ROOT"
npm install --no-audit --no-fund
CLASP_BINARY="$REPO_ROOT/node_modules/.bin/clasp"
[[ -x "$CLASP_BINARY" ]] || { echo 'Binary clasp lokal tidak tersedia.' >&2; exit 1; }
CLASP_VERSION="$(cd "$TEMP_DIR" && "$CLASP_BINARY" --version)"
[[ "$CLASP_VERSION" == '3.3.0' ]] || { echo "Versi clasp harus 3.3.0, ditemukan $CLASP_VERSION" >&2; exit 1; }

if ! node -e "const fs=require('fs');const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,'utf8'));if(!j.tokens&&!j.token)process.exit(1)" "$HOME/.clasprc.json" 2>/dev/null; then
  "$CLASP_BINARY" login --no-localhost
fi
node -e "const fs=require('fs');const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,'utf8'));if(!j.tokens&&!j.token)process.exit(1)" "$HOME/.clasprc.json"

mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"
if [[ -f "$STATE_FILE" ]]; then
  chmod 600 "$STATE_FILE"
  node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));if(typeof j.scriptId!=='string'||!j.scriptId.trim()||j.rootDir!=='src')process.exit(1)" "$STATE_FILE" || { echo 'Resume state tidak valid atau ambigu; tidak akan ditimpa.' >&2; exit 1; }
else
  (
    cd "$TEMP_DIR"
    "$CLASP_BINARY" create --type "$CLASP_TYPE" --title "$APP_TITLE" --rootDir src
    node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('.clasp.json','utf8'));if(typeof j.scriptId!=='string'||!j.scriptId.trim()||j.rootDir!=='src')process.exit(1)"
    install -m 600 .clasp.json "$STATE_FILE"
  )
fi

node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));if(typeof j.scriptId!=='string'||!j.scriptId.trim()||j.rootDir!=='src')process.exit(1)" "$STATE_FILE"
gh_user secret set CLASPRC_JSON --repo "$EXPECTED_REPO" < "$HOME/.clasprc.json"
gh_user secret set CLASP_JSON --repo "$EXPECTED_REPO" < "$STATE_FILE"
for secret_name in CLASPRC_JSON CLASP_JSON; do
  gh_user secret list --repo "$EXPECTED_REPO" --json name --jq '.[].name' | grep -Fx "$secret_name" >/dev/null || { echo "Secret belum terverifikasi: $secret_name" >&2; exit 1; }
  echo "$secret_name: configured"
done
rm -f -- "$STATE_FILE"
rmdir -- "$STATE_DIR" 2>/dev/null || true
echo 'Setup Apps Script dan GitHub Actions secrets selesai.'
