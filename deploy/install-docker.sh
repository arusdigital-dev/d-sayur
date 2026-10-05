#!/bin/bash
set -euo pipefail

if [[ $(id -u) -ne 0 ]]; then
    echo 'Jalankan dengan sudo: sudo bash deploy/install-docker.sh' >&2
    exit 1
fi

. /etc/os-release
case "${ID:-}" in
    ubuntu|debian) ;;
    *) echo "Sistem operasi belum didukung skrip ini: ${ID:-unknown}" >&2; exit 1 ;;
esac

apt-get update
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

arch=$(dpkg --print-architecture)
codename=${VERSION_CODENAME:?VERSION_CODENAME tidak tersedia}
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/%s %s stable\n' \
    "$arch" "$ID" "$codename" >/etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker version
docker compose version

