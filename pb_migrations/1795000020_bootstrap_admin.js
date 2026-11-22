/* eslint-disable */
/// <reference path="../pb_data/types.d.ts" />

/**
 * GH PDF — ilk yönetici hesabı.
 *
 * Şifre repoya yazılmaz. `.env.production` içindeki GHDPDF_ADMIN_EMAIL ve
 * GHDPDF_ADMIN_PASSWORD değerleriyle, veritabanı boşsa bir kez oluşturulur.
 * Hesap zaten varsa dokunulmaz.
 */

migrate(
  (app) => {
    const email = ($os.getenv('GHDPDF_ADMIN_EMAIL') || '').trim().toLowerCase();
    const password = $os.getenv('GHDPDF_ADMIN_PASSWORD') || '';
    if (!email || password.length < 8) return;

    let existing = null;
    try {
      existing = app.findAuthRecordByEmail('users', email);
    } catch (e) {
      // Kayıt yok.
    }
    if (existing) return;

    const users = app.findCollectionByNameOrId('users');
    const admin = new Record(users);
    admin.set('email', email);
    admin.set('emailVisibility', true);
    admin.set('verified', true);
    admin.setPassword(password);
    admin.set('name', 'Dernek Yöneticisi');
    admin.set('phone', '');
    admin.set('birth_date', new DateTime('1990-01-01 00:00:00.000Z'));
    admin.set('legal_status', 'graduate');
    admin.set('school', 'Global Hukukçular Derneği');
    admin.set('city', '');
    admin.set('graduation_year', 1990);
    admin.set('contact_email', email);
    admin.set('kvkk_consent', true);
    admin.set('membership_status', 'approved');
    admin.set('membership_note', 'Yönetici hesabı');
    admin.set('approved_at', new DateTime());
    admin.set('role', 'admin');
    app.save(admin);
  },
  (app) => {
    // Geri alma: yönetici hesabını silme; veri kaybı riski taşır.
  }
);
