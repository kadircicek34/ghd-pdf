# GH PDF — Fazlar ve Kabul Durumu

## Faz 0 — Temel

- [x] Upstream BentoPDF kopyası ve baseline build.
- [x] Kurumsal logo/favicon ve portal tasarımı.
- [x] `pdf.globalhukukcular.com A 169.58.198.19` DNS kaydı (Turkticaret).
- [x] Docker/PocketBase iskeleti.
- [x] Üretim Docker imajı ve container (`ghdpdf-app`).

## Faz 1 — Üyelik backend'i

- [x] `users` üyelik alanları (doğum tarihi, hukuk durumu, okul, KVKK, durum, rol).
- [x] `membership_documents` korumalı e-Devlet belgesi koleksiyonu.
- [x] Başvuru, giriş, çıkış, oturum, admin uç noktaları.
- [x] Public API ile kullanıcı oluşturma/güncelleme kapalı.
- [x] Admin belge görüntüleme ve onay/ret.
- [x] Canlı DB üzerinde uçtan uca test (12/12 Playwright).

## Faz 2 — Portal arayüzü

- [x] Landing page (Türkçe, mobil, animasyonlu, kurumsal).
- [x] Başvuru formu (zorunlu alanlar + dosya doğrulama).
- [x] Giriş, durum ve admin ekranları.
- [x] KVKK/gizlilik ve kullanım koşulları.
- [x] Playwright ile canlı tarayıcı testi (landing, başvuru, onay, giriş, PDF birleştirme).

## Faz 3 — Marka ve Türkçe

- [x] `VITE_BRAND_NAME=GH PDF`, logo, footer.
- [x] `VITE_DEFAULT_LANGUAGE=tr`, `SIMPLE_MODE=true`.
- [x] Portal ve uygulama için Türkçe meta/başlık.
- [x] Build sonrası marka kontrolü; görünür açık kaynak/upstream atıf metinleri temizlendi.

## Faz 4 — Deploy

- [x] `ghdpdf-app` container sağlıklı.
- [x] Caddy `pdf` bloğu + Let's Encrypt TLS.
- [x] Anonim rota kapısı ve üye erişimi canlıda doğru.
- [x] Mevcut servislerde regresyon yok (akademi 500 önceden mevcut).

## Faz 5 — Test ve yayın

- [x] Smoke test: landing, başvuru, pending, admin onayı, üye erişimi, PDF birleştirme.
- [x] Ekran görüntüleri `screenshots/` ve Playwright raporu.
- [ ] Public GitHub repo (`kadircicek34/ghd-pdf`) — push devam ediyor.
- [x] README/NOTICE/AGPL atfı repoda; secret scan temiz.
