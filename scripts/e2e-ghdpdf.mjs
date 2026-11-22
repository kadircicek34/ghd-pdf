#!/usr/bin/env node
/**
 * GH PDF — canlı uçtan uca test.
 *
 * Gerekli:
 *   npm i -D playwright   (veya npx playwright install chromium)
 *
 * Ortam:
 *   BASE_URL=https://pdf.globalhukukcular.com
 *   GHDPDF_ADMIN_EMAIL=...
 *   GHDPDF_ADMIN_PASSWORD=...
 *
 * Test, benzersiz bir başvuru oluşturur; yönetici onayından sonra üye
 * girişini ve PDF birleştirmeyi doğrular. Üretimde test kaydını silmek için
 * PocketBase superuser API'sini kullanın.
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = (
  process.env.BASE_URL || 'https://pdf.globalhukukcular.com'
).replace(/\/$/, '');
const ADMIN_EMAIL = process.env.GHDPDF_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.GHDPDF_ADMIN_PASSWORD;
const stamp = Date.now();
const TEST_EMAIL =
  process.env.GHDPDF_TEST_EMAIL || `e2e.${stamp}@globalhukukcular.com`;
const TEST_PASSWORD = process.env.GHDPDF_TEST_PASSWORD || `E2e!${stamp}Aa`;
const FIXTURE = path.resolve(__dirname, '../tests/fixtures/ghdpdf-test.pdf');
const SHOTS = path.resolve(__dirname, '../screenshots');

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('GHDPDF_ADMIN_EMAIL ve GHDPDF_ADMIN_PASSWORD gerekli.');
  process.exit(2);
}

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ' — ' + extra : ''}`);
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, name), fullPage: true });
}

const browser = await chromium.launch({ headless: true });
try {
  // 1. Landing + mobil
  {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const res = await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    check('Landing 200', res && res.status() === 200);
    check('Landing başlığı GH PDF', (await page.title()).includes('GH PDF'));
    check(
      'Landing logosu',
      (await page.locator('img.brand__mark').count()) > 0
    );
    await page.waitForTimeout(1200);
    await shot(page, 'live-landing.png');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    check(
      'Mobil landing menü',
      (await page.locator('[data-menu-toggle]').count()) > 0
    );
    await shot(page, 'live-landing-mobile.png');
    await page.close();
  }

  // 2. Anonim korumalı rota
  {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    await page.goto(BASE + '/uygulama/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    check('Anonim /uygulama/ girişe yönlenir', page.url().includes('/giris'));
    await page.close();
  }

  // 3. Başvuru formu — zorunlu alan doğrulaması
  {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1200 },
    });
    await page.goto(BASE + '/basvuru/', { waitUntil: 'networkidle' });
    await page.click('#apply-submit');
    await page.waitForTimeout(300);
    const alert = await page.locator('#apply-alert').innerText();
    check(
      'Başvuru zorunlu alan doğrulaması',
      alert.length > 0,
      alert.split('\n')[0]
    );
    await page.close();
  }

  // 4. Başvuru oluştur
  let applicantName = 'E2E Test Kullanıcı';
  {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1200 },
    });
    await page.goto(BASE + '/basvuru/', { waitUntil: 'networkidle' });
    await page.fill('#full_name', applicantName);
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#phone', '05550001122');
    await page.fill('#birth_date', '1993-03-03');
    await page.selectOption('#legal_status', 'graduate');
    await page.fill(
      '#school',
      'Global Hukukçular Test Üniversitesi Hukuk Fakültesi'
    );
    await page.fill('#graduation_year', '2017');
    await page.selectOption('#doc_type', 'diploma');
    await page.setInputFiles('#document', FIXTURE);
    await page.check('#kvkk_consent');
    await page.fill('#password', TEST_PASSWORD);
    await page.fill('#password_confirm', TEST_PASSWORD);
    await Promise.all([
      page.waitForURL('**/durum/**', { timeout: 30000 }),
      page.click('#apply-submit'),
    ]);
    await page.waitForTimeout(1000);
    const title = await page.locator('#status-title').innerText();
    check('Başvuru pending durumda', title.includes('onay bekliyor'), title);
    await shot(page, 'live-pending.png');
    await page.close();
  }

  // 5. Admin onayı + belge görüntüleme
  let documentOk = false;
  {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1200 },
    });
    await page.goto(BASE + '/admin/', { waitUntil: 'networkidle' });
    await page.fill('#admin-email', ADMIN_EMAIL);
    await page.fill('#admin-password', ADMIN_PASSWORD);
    await page.click('#admin-login-submit');
    await page.waitForSelector('#admin-dashboard', {
      state: 'visible',
      timeout: 30000,
    });
    await page.waitForTimeout(800);
    const card = page.locator('.applicant', { hasText: applicantName }).first();
    if ((await card.count()) === 0)
      throw new Error('Admin listesinde başvuru bulunamadı');
    const docId = await card
      .locator('button[data-doc]')
      .getAttribute('data-doc')
      .catch(() => null);
    await card.locator('button[data-review]').click();
    await page.waitForSelector('#decision-modal.is-open');
    await shot(page, 'live-admin-review.png');
    // Belge yanıtını doğrula (admin çereziyle)
    if (docId) {
      const docCheck = await page.evaluate(async (id) => {
        const res = await fetch(
          '/api/ghdpdf/admin/document?id=' + encodeURIComponent(id)
        );
        const blob = await res.blob();
        return {
          status: res.status,
          type: res.headers.get('content-type'),
          size: blob.size,
        };
      }, docId);
      documentOk =
        docCheck.status === 200 &&
        docCheck.type === 'application/pdf' &&
        docCheck.size > 0;
      console.log('belge kontrolü', docCheck);
    }
    await page.fill('#decision-note', 'E2E testi: belge ve bilgiler uygun.');
    await page.click('#decision-approve');
    await page.waitForTimeout(1200);
    const alert = await page.locator('#admin-alert').innerText();
    check('Admin başvuruyu onayladı', alert.includes('onaylandı'), alert);
    check('Admin oturumu ve belge erişimi', documentOk);
    await page.close();
  }

  // 6. Üye girişi + uygulama + PDF birleştirme
  {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1100 },
      acceptDownloads: true,
    });
    await page.goto(BASE + '/giris/', { waitUntil: 'networkidle' });
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);
    await page.click('#login-submit');
    await page.waitForURL('**/uygulama/**', { timeout: 30000 });
    await page.waitForTimeout(1200);
    check('Üye uygulamaya girdi', page.url().includes('/uygulama/'));
    check(
      'Uygulama Türkçe',
      (await page.locator('h1').first().innerText()).includes('PDF')
    );
    await shot(page, 'live-app.png');
    await page.goto(BASE + '/uygulama/tr/merge-pdf.html', {
      waitUntil: 'networkidle',
    });
    await page.waitForTimeout(800);
    await page.setInputFiles('input[type=file]', [FIXTURE, FIXTURE]);
    await page.waitForTimeout(1500);
    const downloadPromise = page
      .waitForEvent('download', { timeout: 30000 })
      .catch(() => null);
    await page.getByRole('button', { name: "PDF'leri Birleştir" }).click();
    const download = await downloadPromise;
    check(
      'PDF birleştirme indirme',
      Boolean(download),
      download ? await download.suggestedFilename() : ''
    );
    await page.close();
  }

  // 7. Rapor
  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} test geçti.`
  );
  if (failed.length) process.exit(1);
} finally {
  await browser.close();
}
