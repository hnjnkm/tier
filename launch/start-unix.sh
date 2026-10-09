#!/usr/bin/env bash
set -euo pipefail
app_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$app_root"

if [[ "${MY_TIER_FORCE_PORTABLE_NODE:-0}" != "1" ]] && command -v node >/dev/null 2>&1 && node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)' && command -v npm >/dev/null 2>&1; then
  exec node launch/run.mjs
fi

case "$(uname -s)" in Darwin) node_os=darwin ;; Linux) node_os=linux ;; *) echo 'This launcher supports macOS and Linux.'; exit 1 ;; esac
case "$(uname -m)" in arm64|aarch64) node_arch=arm64 ;; x86_64|amd64) node_arch=x64 ;; *) echo 'This launcher supports x64 and arm64 computers.'; exit 1 ;; esac
node_version=v24.19.0
archive="node-${node_version}-${node_os}-${node_arch}.tar.gz"
node_root="$app_root/.runtime/node-${node_version}-${node_os}-${node_arch}"
if [[ ! -x "$node_root/bin/node" ]]; then
  mkdir -p .runtime
  echo 'Downloading the Node.js runtime. An internet connection is required.'
  curl --fail --location --show-error "https://nodejs.org/dist/${node_version}/${archive}" --output ".runtime/${archive}.download"
  curl --fail --location --silent --show-error "https://nodejs.org/dist/${node_version}/SHASUMS256.txt" --output .runtime/SHASUMS256.txt
  expected_sha="$(awk -v wanted="$archive" '$2 == wanted { print $1 }' .runtime/SHASUMS256.txt)"
  [[ "$expected_sha" =~ ^[a-f0-9]{64}$ ]] || { echo 'No official checksum was found. Download stopped.'; exit 1; }
  if command -v sha256sum >/dev/null 2>&1; then
    actual_sha="$(sha256sum ".runtime/${archive}.download" | awk '{print $1}')"
  else
    actual_sha="$(shasum -a 256 ".runtime/${archive}.download" | awk '{print $1}')"
  fi
  [[ "$actual_sha" == "$expected_sha" ]] || { rm -f ".runtime/${archive}.download"; echo 'Checksum verification failed. Download stopped.'; exit 1; }
  tar -xzf ".runtime/${archive}.download" -C .runtime
  rm -f ".runtime/${archive}.download"
fi
export PATH="$node_root/bin:$PATH"
exec "$node_root/bin/node" launch/run.mjs
