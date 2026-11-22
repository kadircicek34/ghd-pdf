#!/usr/bin/env node
/**
 * GH PDF — build sonrası marka ve indeksleme düzeltmeleri.
 *
 * Upstream BentoPDF sayfalarındaki görünür marka, canonical/OG adresleri ve
 * robots meta'sını GH PDF'e uyarlar. Lisans/atıf sayfasına dokunmaz.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../dist');
const SKIP = new Set(['licensing.html']);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

let changed = 0;
for (const file of walk(DIST)) {
  if (SKIP.has(path.basename(file))) continue;

  const source = fs.readFileSync(file, 'utf8');
  let html = source;

  // Görünür marka ve meta alanları.
  html = html.replaceAll('BentoPDF', 'GH PDF');
  html = html.replaceAll('@GH PDF', '@globalhukukcular');
  html = html.replaceAll('@BentoPDF', '@globalhukukcular');

  // Upstream JSON-LD / veri işaretleri üyeye özel sitede görünmesin.
  html = html.replace(
    /<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi,
    ''
  );
  html = html.replaceAll('data-bentopdf-', 'data-ghdpdf-');
  html = html.replaceAll('bentopdf.com', 'GH PDF');
  // Yapay zeka modeli adı görünmesin (fonksiyon adlarına dokunmadan).
  html = html.replace(/(?<![A-Za-z])LlamaIndex/g, 'JSON');
  html = html.replace(/(?<![A-Za-z])Llama(?![A-Za-z])/g, 'JSON');
  html = html.replaceAll('JSON JSON', 'JSON');

  // Dil.
  html = html.replace(/<html lang="en"/g, '<html lang="tr"');

  // Arama motorları: üyeye özel uygulama indekslenmemeli.
  html = html.replace(
    /(<meta\s+name="robots"\s+content=")[^"]*(")/gi,
    '$1noindex, nofollow, noarchive$2'
  );

  // Canonical / OG adresleri.
  html = html.replace(
    /(rel="canonical"\s+href=")https:\/\/www\.bentopdf\.com([^"]*)"/g,
    '$1https://pdf.globalhukukcular.com/uygulama$2"'
  );
  html = html.replace(
    /(property="og:url"\s+content=")https:\/\/www\.bentopdf\.com([^"]*)"/g,
    '$1https://pdf.globalhukukcular.com/uygulama$2"'
  );
  html = html.replace(
    /(property="og:image"\s+content=")https:\/\/www\.bentopdf\.com\/images\//g,
    '$1https://pdf.globalhukukcular.com/uygulama/images/'
  );
  html = html.replace(
    /(name="twitter:image"\s+content=")https:\/\/www\.bentopdf\.com\/images\//g,
    '$1https://pdf.globalhukukcular.com/uygulama/images/'
  );

  // apply-indexing-policy bazen alan adını build sırasında değiştirir.
  html = html.replaceAll(
    'https://pdf.globalhukukcular.com/images/',
    'https://pdf.globalhukukcular.com/uygulama/images/'
  );

  if (html !== source) {
    fs.writeFileSync(file, html);
    changed++;
  }
}

console.log(`[ghdpdf-branding] ${changed} HTML dosyası güncellendi.`);

/* ------------------------------------------------------------------ */
/* GH PDF: üyeye özel sitede açık kaynak / upstream pazarlama içeriği  */
/* görünmesin. Lisans metni repoda (LICENSE/NOTICE) korunur.           */
/* ------------------------------------------------------------------ */
const REMOVE_PAGES = new Set([
  'about.html',
  'contact.html',
  'faq.html',
  'privacy.html',
  'terms.html',
  'licensing.html',
  'kura.html',
  'advertise.html',
  'hyper-compress.html',
  'prepare-pdf-for-ai.html',
]);

function prune(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'blog') {
        fs.rmSync(full, { recursive: true, force: true });
        continue;
      }
      prune(full);
    } else if (entry.isFile()) {
      if (REMOVE_PAGES.has(entry.name)) {
        fs.rmSync(full, { force: true });
      } else if (
        entry.name === 'CHANGELOG.md' ||
        entry.name === 'funding.json'
      ) {
        fs.rmSync(full, { force: true });
      }
    }
  }
}
prune(DIST);

// Hyper Compress aracını çalışma zamanında gizle (kart + doğrudan erişim).
fs.writeFileSync(
  path.join(DIST, 'config.json'),
  JSON.stringify(
    { disabledTools: ['hyper-compress', 'prepare-pdf-for-ai'] },
    null,
    2
  ) + '\n'
);

let scrubbed = 0;
for (const file of walk(DIST)) {
  if (SKIP.has(path.basename(file))) continue;
  const source = fs.readFileSync(file, 'utf8');
  let html = source;

  // Kalan sayfalarda görünür lisans / açık kaynak ifadelerini kaldır.
  html = html.replace(
    /<span[^>]*data-i18n="tools:wasmSettings\.licenseDescription"[^>]*>[\s\S]*?<\/span>/g,
    '<span>Harici modüller kendi lisans koşullarına tabidir.</span>'
  );
  html = html.replace(
    /<a[^>]*href="[^"]*hyper-compress[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
    '$1'
  );
  html = html.replace(
    /<a[^>]*href="[^"]*prepare-pdf-for-ai[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
    '$1'
  );
  html = html.replaceAll('Hyper Compress', 'GH PDF sıkıştırma motoru');
  html = html.replaceAll('AGPL-3.0', 'ilgili lisans');
  html = html.replaceAll('AGPL', 'ilgili lisans');
  html = html.replaceAll('açık kaynak', 'GH PDF');
  html = html.replaceAll('Açık kaynak', 'GH PDF');
  html = html.replaceAll('open source', 'GH PDF');
  html = html.replaceAll('Open source', 'GH PDF');
  html = html.replaceAll('Open Source', 'GH PDF');
  html = html.replaceAll('copyleft', 'lisans');

  if (html !== source) {
    fs.writeFileSync(file, html);
    scrubbed++;
  }
}

/* JSON çeviri dosyalarındaki marka / lisans ifadelerini de temizle. */
function walkJson(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJson(full));
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
  }
  return out;
}

let jsonScrubbed = 0;
for (const file of walkJson(DIST)) {
  const source = fs.readFileSync(file, 'utf8');
  let text = source
    .replaceAll('BentoPDF', 'GH PDF')
    .replaceAll('bentopdf.com', 'GH PDF')
    .replaceAll('AGPL-3.0', 'ilgili lisans')
    .replaceAll('AGPL', 'ilgili lisans')
    .replaceAll('açık kaynak', 'GH PDF')
    .replaceAll('Açık kaynak', 'GH PDF')
    .replaceAll('open source', 'GH PDF')
    .replaceAll('Open source', 'GH PDF')
    .replaceAll('Open Source', 'GH PDF')
    .replaceAll('copyleft', 'lisans')
    .replace(/(?<![A-Za-z])LlamaIndex/g, 'JSON')
    .replace(/(?<![A-Za-z])Llama(?![A-Za-z])/g, 'JSON')
    .replaceAll('JSON JSON', 'JSON');
  if (text !== source) {
    fs.writeFileSync(file, text);
    jsonScrubbed++;
  }
}
console.log(`[ghdpdf-branding] ${jsonScrubbed} JSON dosyası temizlendi.`);

/* JS bundle içindeki görünür upstream marka / lisans metinlerini temizle. */
function walkJs(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJs(full));
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

let jsScrubbed = 0;
for (const file of walkJs(DIST)) {
  const source = fs.readFileSync(file, 'utf8');
  let text = source
    .replaceAll('BentoPDF', 'GH PDF')
    .replaceAll('Hyper Compress', 'GH PDF sıkıştırma motoru')
    .replaceAll('AGPL-3.0', 'ilgili lisans')
    .replaceAll('AGPL', 'ilgili lisans')
    .replaceAll('açık kaynak', 'GH PDF')
    .replaceAll('Açık kaynak', 'GH PDF')
    .replaceAll('open source', 'GH PDF')
    .replaceAll('Open source', 'GH PDF')
    .replaceAll('Open Source', 'GH PDF')
    .replaceAll('copyleft', 'lisans')
    .replace(/(?<![A-Za-z])LlamaIndex/g, 'JSON')
    .replace(/(?<![A-Za-z])Llama(?![A-Za-z])/g, 'JSON')
    .replaceAll('JSON JSON', 'JSON');
  if (text !== source) {
    fs.writeFileSync(file, text);
    jsScrubbed++;
  }
}
console.log(`[ghdpdf-branding] ${jsScrubbed} JS dosyası temizlendi.`);

console.log(
  `[ghdpdf-branding] ${scrubbed} sayfada lisans/open-source metni temizlendi.`
);
