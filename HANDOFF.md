# GH PDF — Oturum Handoff

Son güncelleme: 22 Kasım 2026
Canlı: **https://pdf.globalhukukcular.com**
Sunucu: `169.58.198.19`
Repo: **https://github.com/kadircicek34/ghd-pdf**

## Özet

BentoPDF (AGPL-3.0) fork'u, Global Hukukçular Derneği için **GH PDF** adıyla
özelleştirildi ve canlıya alındı.

- Landing, giriş, başvuru, durum, admin ve yasal sayfalar Türkçe.
- Platform yalnızca onaylı dernek üyelerine açık.
- Başvuruda doğum tarihi, hukuk öğrencisi/mezunu bilgisi, e-Devlet belgesi
  (PDF/JPG/PNG, max 10 MB) ve KVKK onayı zorunlu.
- Başvurular `pending`; admin onayı olmadan `/uygulama/*` açılmaz.
- e-Devlet belgesi public değil; yalnızca yetkili admin görüntüleyebilir.
- PDF işlemleri tarayıcıda çalışır; kullanıcı belgeleri sunucuya yüklenmez.
- Uygulama `/uygulama/` altında, varsayılan dil Türkçe.
- Görünür açık kaynak/BentoPDF atıf metinleri siteden kaldırıldı (kullanıcı
  talebi). Lisans ve atıf `LICENSE` / `NOTICE` / repoda korunuyor.

## Erişim / sırlar

- Admin paneli: https://pdf.globalhukukcular.com/admin
  - E-posta: `kadircicek13@icloud.com`
  - Şifre: `/root/pdf/ghdpdf-admin-credentials.txt` (root-only)
- PocketBase superuser: aynı dosyada.
- Üretim env: `/root/pdf/bentopdf/deploy/.env.production` (gitignored).
- DNS panel: `/root/pdf/bentopdf/.deploy-secrets` (gitignored).

## Topoloji

- Container: `ghdpdf-app` (PocketBase + portal + `/uygulama/` statik uygulama)
- Volume: `ghdpdf_pb_data`
- Ağ: `gakademi_default`, alias `ghdpdf-app:8090`
- Caddy: `gakademi-caddy-1`, `/root/Gakademi/deploy/Caddyfile`
  - Yedek: `Caddyfile.bak-ghdpdf-2026-11-22-*`
- DNS: `pdf.globalhukukcular.com A 169.58.198.19`
- TLS: Let's Encrypt, 20 Şubat 2027'ye kadar geçerli.

## Komutlar

```bash
cd /root/pdf/bentopdf

# derleme
./scripts/build-ghd.sh

# container
docker compose -f deploy/docker-compose.yml up -d --build
docker logs -f ghdpdf-app

# Caddy doğrula/reload
docker exec gakademi-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec gakademi-caddy-1 caddy reload --config /etc/caddy/Caddyfile

# canlı e2e
GHDPDF_ADMIN_EMAIL=... GHDPDF_ADMIN_PASSWORD=... \
  BASE_URL=https://pdf.globalhukukcular.com node scripts/e2e-ghdpdf.mjs
```

## Test durumu

- Canlı Playwright: **12/12** (landing, mobil, anonim kapı, başvuru doğrulama,
  pending, admin onayı, belge görüntüleme, üye girişi, PDF birleştirme).
- Canlı smoke: landing 200, `/api/health` 200, anonim `/uygulama/` → `/giris`.
- Regresyon: dil/spor/kariyer/oyun/ana site 200. `akademi` 500 durumu
  bu çalışmadan önce de vardı; GH PDF bu servise dokunmaz.

## Notlar

- `deploy/.env.production`, `.deploy-secrets`, `.pb/`, `dist/`, `screenshots/`
  git'e girmez.
- Yeni başvurular admin panelinde `Bekleyen` sekmesinde görünür.
- Ret için gerekçe zorunludur; ret edilen üyenin oturumu açık olsa bile
  `/uygulama/*` erişimi kesilir.
- e-Devlet belgesi PocketBase storage'da rastgele adla tutulur; yalnızca admin
  endpoint'i üzerinden `application/pdf` / görsel olarak sunulur.
- Üretimde test kullanıcısı bırakılmadı; e2e kayıtları superuser API ile silindi.
