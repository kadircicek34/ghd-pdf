# GH PDF — Çalışma Kuralları ve Proje Özeti

## Proje

- Kaynak: https://github.com/alam00000/bentopdf (AGPL-3.0)
- Hedef: Global Hukukçular Derneği üyelerine özel PDF platformu
- Canlı: https://pdf.globalhukukcular.com
- Referans kurumsal site: https://globalhukukcular.com
- Marka: **GH PDF** — bronz amblem, lacivert/bronz altın/krem kurumsal kimlik
- Erişim: yalnızca onaylı dernek üyeleri

## Değişmez kabul kriterleri

1. Landing page canlıda 200 döner; logo, Türkçe içerik ve mobil görünüm doğrudur.
2. Giriş yapmamış ziyaretçi yalnızca landing, giriş, başvuru, durum ve yasal sayfalara erişir; `/uygulama/*` girişe yönlenir.
3. Başvuru formu doğum tarihi, hukuk durumu (öğrenci/mezun), e-Devlet belgesi ve KVKK onayı olmadan gönderilemez.
4. Başvuru `pending` durumunda saklanır; admin onayı olmadan `/uygulama/*` açılmaz.
5. Yüklenen e-Devlet belgesi public erişime açık değildir; yalnızca yetkili admin görebilir.
6. Admin başvuruyu doğum tarihi, hukuk durumu ve belgeyle birlikte görür; onaylar/reddeder. Ret gerekçesi görünür.
7. Onaylanan üye giriş yapıp PDF araçlarını kullanabilir; bekleyen/reddedilen üye açık Türkçe hata alır.
8. Marka GH PDF'dir; logo, favicon, metadata ve varsayılan arayüz dili Türkçedir.
9. Canlıda geçerli HTTPS sertifikası vardır; HTTP, HTTPS'e yönlenir; DNS `pdf` kaydı sunucuya gider.
10. Public GitHub reposunda sır (şifre, API anahtarı, .env) yoktur; AGPL lisansı ve kaynak atfı korunur.
11. Playwright/smoke testleri landing, başvuru, admin onayı, üye girişi ve korumalı rota için geçer.
12. Mevcut `akademi`, `dil`, `spor`, `oyun`, `kariyer` servisleri ve Caddy yapılandırması bozulmamıştır.
13. Sitede hiçbir yapay zeka modeli adı (ChatGPT, GPT, Claude, Gemini, Llama, DeepSeek vb.) görünmez.

## Süreç

- Fazlar sırayla ilerler; kabul kriteri kanıtlanmadan sonraki faza geçilmez.
- Kodlama işleri alt ajana, denetim ayrı alt ajana verilebilir.
- Alt ajanlar background'da çalışır; ana ajan raporu doğrular.
- Her fazın sonunda `TASKS.md` ve gerekiyorsa `HANDOFF.md` güncellenir.
- Caddy değişikliğinden önce yedek alınır; mevcut container/volume/DB'lere dokunulmaz.
- Sırlar `.deploy-secrets`, `deploy/.env.production` ve `/root/pdf/ghdpdf-admin-credentials.txt` dışında tutulmaz.
