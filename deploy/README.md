# GH PDF — Üretim deploy notları

- Canlı adres: **https://pdf.globalhukukcular.com**
- Container: `ghdpdf-app` (PocketBase + portal + `/uygulama/` statik uygulama)
- Veri: `ghdpdf_pb_data` Docker volume
- Caddy: mevcut `gakademi-caddy-1` container'ı, `gakademi_default` ağı
- Ağ takma adı: `ghdpdf-app:8090`

## 1. Derleme

```bash
cd /root/pdf/bentopdf
./scripts/build-ghd.sh
```

Çıktı: `dist/` (BentoPDF, `/uygulama/` base path'i ile).

## 2. Ortam

```bash
cp deploy/.env.example deploy/.env.production
chmod 600 deploy/.env.production
# GHDPDF_ADMIN_EMAIL ve GHDPDF_ADMIN_PASSWORD değerlerini düzenle
```

`deploy/.env.production`, `.deploy-secrets` ve `.pb/` git'e girmez.

İlk açılışta migration, `GHDPDF_ADMIN_EMAIL` / `GHDPDF_ADMIN_PASSWORD`
değerleriyle yönetici hesabını oluşturur. Hesap zaten varsa dokunulmaz.
PocketBase superuser'ı ayrıca CLI ile oluşturulabilir:

```bash
docker exec ghdpdf-app ./pocketbase superuser upsert EMAIL GUCLU_SIFRE --dir=/app/pb_data
```

## 3. Container

```bash
docker compose -f deploy/docker-compose.yml up -d --build
docker compose -f deploy/docker-compose.yml ps
docker logs -f ghdpdf-app
```

## 4. Caddy

`deploy/Caddyfile.snippet` içindeki blokları `/root/Gakademi/deploy/Caddyfile`
sonuna ekleyin. Değişiklikten önce yedek alın:

```bash
cp /root/Gakademi/deploy/Caddyfile /root/Gakademi/deploy/Caddyfile.bak-ghdpdf
docker exec gakademi-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec gakademi-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

## 5. DNS

`pdf.globalhukukcular.com A 169.58.198.19` kaydı Turkticaret panelinde
tanımlıdır. DNS yayıldıktan sonra Caddy Let's Encrypt sertifikasını otomatik alır.

## 6. Smoke test

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://pdf.globalhukukcular.com/
curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' https://pdf.globalhukukcular.com/uygulama/
curl -sS https://pdf.globalhukukcular.com/api/health
```

Beklenen: landing 200; anonim `/uygulama/` → `/giris?next=...` 302;
`/api/health` 200.

## 7. Yedek

```bash
docker run --rm -v ghdpdf_pb_data:/data -v /root/pdf/backups:/backup alpine \
  tar czf /backup/ghdpdf-$(date +%F).tgz -C /data .
```

## 8. Güncelleme

```bash
cd /root/pdf/bentopdf
git pull
./scripts/build-ghd.sh
docker compose -f deploy/docker-compose.yml up -d --build
```

PocketBase migration'ları container açılışında otomatik uygulanır.

## 9. Sorun giderme

- `/uygulama/` 401: kullanıcı onaylı değil veya oturum süresi dolmuş.
- `/admin` girişinde "yönetim yetkisi yok": kullanıcı `role=admin` değil.
- Belge açılmıyor: `ghdpdf-app` loglarında `document read failed` var mı bakın.
- 413: Caddy `request_body max_size 12MB` ve PB dosya sınırı 10MB.
