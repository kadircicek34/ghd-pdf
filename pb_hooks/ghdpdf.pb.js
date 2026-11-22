/* eslint-disable */
/// <reference path="../pb_data/types.d.ts" />

/**
 * GH PDF — üyelik, oturum ve yönetim uç noktaları.
 *
 * Tasarım:
 *  - Public kullanıcı oluşturma kapalıdır. Başvuru `POST /api/ghdpdf/apply`
 *    üzerinden alınır; kullanıcı + e-Devlet belgesi tek işlemde oluşturulur.
 *  - Oturum, HttpOnly `ghdpdf_auth` çerezi ile taşınır. Çerezdeki PocketBase
 *    auth token'ı her istekte yeniden doğrulanır; üyelik durumu değişirse
 *    erişim anında kesilir.
 *  - `/uygulama/*` altındaki tüm statik dosyalar yalnızca `approved` üyelere
 *    açıktır. Giriş yapmamış ziyaretçi `/giris` sayfasına yönlendirilir.
 *  - Yönetim uçları `role=admin` + `membership_status=approved` ister.
 *
 * Not: PocketBase JSVM her handler'ı ayrı bir runtime'da çalıştırır. Bu yüzden
 * yardımcı fonksiyonlar her handler'ın İÇİNDE tanımlanır.
 */

console.log('[ghdpdf] membership hooks loaded');

/* ------------------------------------------------------------------ */
/* Başvuru                                                             */
/* ------------------------------------------------------------------ */
routerAdd('POST', '/api/ghdpdf/apply', function (e) {
  function userJson(u) {
    return {
      id: u.id,
      name: u.getString('name'),
      email: u.getString('contact_email') || u.getString('email'),
      role: u.getString('role') || 'user',
      membership_status: u.getString('membership_status') || 'pending',
      membership_note: u.getString('membership_note') || '',
      birth_date: u.getString('birth_date'),
      legal_status: u.getString('legal_status'),
      school: u.getString('school'),
      city: u.getString('city'),
      graduation_year: u.getInt('graduation_year'),
      approved_at: u.getString('approved_at'),
      created: u.getString('created'),
      phone: u.getString('phone'),
    };
  }
  function text(value) {
    return value === undefined || value === null ? '' : String(value).trim();
  }
  function sameOrigin() {
    var headers = e.requestInfo().headers;
    var origin = text(headers['origin']);
    if (!origin) return true;
    var host = text(e.request.host || headers['host']);
    if (!host) return false;
    return origin === 'https://' + host || origin === 'http://' + host;
  }
  function isLimited(ip) {
    var store = $app.store();
    var key = 'ghdpdf:apply:' + ip;
    var now = Date.now();
    var entry = store.get(key);
    if (!entry || !entry.reset || entry.reset < now) {
      store.set(key, { count: 1, reset: now + 60 * 60 * 1000 });
      return false;
    }
    if (entry.count >= 10) return true;
    entry.count = entry.count + 1;
    store.set(key, entry);
    return false;
  }

  if (!sameOrigin())
    return e.json(403, { error: 'İstek kaynağı doğrulanamadı.' });
  if (isLimited(e.realIP())) {
    return e.json(429, {
      error: 'Çok fazla başvuru denemesi. Lütfen daha sonra tekrar deneyin.',
    });
  }

  try {
    e.request.parseMultipartForm(33554432);
  } catch (err) {
    return e.json(400, { error: 'Form verisi okunamadı.' });
  }

  var info = e.requestInfo();
  var body = info.body || {};
  var fullName = text(body.full_name);
  var email = text(body.email).toLowerCase();
  var phone = text(body.phone);
  var birthRaw = text(body.birth_date);
  var legalStatus = text(body.legal_status);
  var school = text(body.school);
  var city = text(body.city);
  var graduationRaw = text(body.graduation_year);
  var password = text(body.password);
  var passwordConfirm = text(body.password_confirm);
  var kvkk = text(body.kvkk_consent);
  var docType = text(body.doc_type);

  if (fullName.length < 3 || fullName.length > 120) {
    return e.json(400, {
      error: 'Ad soyad 3–120 karakter arasında olmalıdır.',
    });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return e.json(400, { error: 'Geçerli bir e-posta adresi girin.' });
  }
  if (phone.length < 7 || phone.length > 20) {
    return e.json(400, { error: 'Geçerli bir telefon numarası girin.' });
  }
  if (legalStatus !== 'student' && legalStatus !== 'graduate') {
    return e.json(400, {
      error: 'Hukuk öğrencisi veya mezunu olduğunuzu seçin.',
    });
  }
  if (school.length < 3 || school.length > 160) {
    return e.json(400, { error: 'Üniversite / fakülte bilgisi zorunludur.' });
  }
  if (city.length > 80)
    return e.json(400, { error: 'Şehir bilgisi çok uzun.' });
  if (password.length < 8 || password.length > 128) {
    return e.json(400, { error: 'Şifre 8–128 karakter arasında olmalıdır.' });
  }
  if (password !== passwordConfirm) {
    return e.json(400, { error: 'Şifreler birbiriyle eşleşmiyor.' });
  }
  if (kvkk !== 'true' && kvkk !== '1' && kvkk !== 'on') {
    return e.json(400, {
      error: 'KVKK aydınlatma metnini onaylamanız gerekir.',
    });
  }
  if (docType !== 'student_certificate' && docType !== 'diploma') {
    return e.json(400, { error: 'Belge türünü seçin.' });
  }

  if (birthRaw.length < 10) {
    return e.json(400, { error: 'Geçerli bir doğum tarihi girin.' });
  }
  var birthCheck = new Date(
    birthRaw.length === 10 ? birthRaw + 'T00:00:00Z' : birthRaw
  );
  if (isNaN(birthCheck.getTime()) || birthCheck.getTime() > Date.now()) {
    return e.json(400, {
      error: 'Geçerli bir doğum tarihi girin; tarih gelecekte olamaz.',
    });
  }
  if (birthCheck.getUTCFullYear() < 1900) {
    return e.json(400, { error: 'Geçerli bir doğum tarihi girin.' });
  }

  var gradYear = 0;
  if (graduationRaw) {
    gradYear = parseInt(graduationRaw, 10);
    if (isNaN(gradYear) || gradYear < 1950 || gradYear > 2100) {
      return e.json(400, { error: 'Geçerli bir mezuniyet yılı girin.' });
    }
  }
  if (legalStatus === 'graduate' && !gradYear) {
    return e.json(400, { error: 'Mezunlar için mezuniyet yılı zorunludur.' });
  }

  var files = e.findUploadedFiles('document');
  var file = files && files.length ? files[0] : null;
  if (!file) return e.json(400, { error: 'e-Devlet belgenizi yükleyin.' });
  if (!file.size) return e.json(400, { error: 'Belge dosyası boş.' });
  if (file.size > 10 * 1024 * 1024) {
    return e.json(400, { error: 'Belge boyutu 10 MB sınırını aşamaz.' });
  }
  var originalName = String(file.name || 'belge');
  var dot = originalName.lastIndexOf('.');
  var ext = dot >= 0 ? originalName.substring(dot).toLowerCase() : '';
  if (['.pdf', '.jpg', '.jpeg', '.png'].indexOf(ext) === -1) {
    return e.json(400, { error: 'Belge yalnızca PDF, JPG veya PNG olabilir.' });
  }

  try {
    $app.findAuthRecordByEmail('users', email);
    return e.json(409, {
      error: 'Bu e-posta ile bir hesap zaten var. Giriş yapmayı deneyin.',
    });
  } catch (notFound) {
    // Beklenen durum: e-posta kayıtlı değil.
  }

  var user;
  try {
    var users = $app.findCollectionByNameOrId('users');
    user = new Record(users);
    user.set('email', email);
    user.set('emailVisibility', false);
    user.set('verified', false);
    user.setPassword(password);
    user.set('name', fullName);
    user.set('phone', phone);
    user.set(
      'birth_date',
      new DateTime(birthRaw + (birthRaw.length === 10 ? ' 00:00:00.000Z' : ''))
    );
    user.set('legal_status', legalStatus);
    user.set('school', school);
    user.set('city', city);
    if (gradYear) user.set('graduation_year', gradYear);
    user.set('contact_email', email);
    user.set('kvkk_consent', true);
    user.set('membership_status', 'pending');
    user.set('membership_note', '');
    user.set('approved_at', '');
    user.set('role', 'user');
    $app.save(user);
  } catch (err) {
    console.log('[ghdpdf] apply user save failed:', err);
    return e.json(400, {
      error:
        'Başvuru oluşturulamadı. Bilgileri kontrol edin; e-posta adresi kullanımda olabilir.',
    });
  }

  try {
    file.name = 'belge_' + $security.randomString(20) + ext;
    var docs = $app.findCollectionByNameOrId('membership_documents');
    var doc = new Record(docs);
    doc.set('user', user.id);
    doc.set('doc_type', docType);
    doc.set('document', file);
    $app.save(doc);
  } catch (err) {
    console.log('[ghdpdf] apply document save failed:', err);
    try {
      $app.delete(user);
    } catch (cleanupErr) {
      console.log('[ghdpdf] cleanup failed:', cleanupErr);
    }
    return e.json(400, {
      error:
        "Belge yüklenemedi. PDF, JPG veya PNG olduğundan ve 10 MB'ı aşmadığından emin olun.",
    });
  }

  e.setCookie(
    new Cookie({
      name: 'ghdpdf_auth',
      value: user.newAuthToken(),
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      secure:
        e.isTLS() ||
        String((e.requestInfo().headers || {})['x-forwarded-proto'] || '') ===
          'https',
      sameSite: 1,
    })
  );
  return e.json(200, { ok: true, user: userJson(user) });
});

/* ------------------------------------------------------------------ */
/* Giriş / çıkış / oturum                                              */
/* ------------------------------------------------------------------ */
routerAdd('POST', '/api/ghdpdf/login', function (e) {
  function userJson(u) {
    return {
      id: u.id,
      name: u.getString('name'),
      email: u.getString('contact_email') || u.getString('email'),
      role: u.getString('role') || 'user',
      membership_status: u.getString('membership_status') || 'pending',
      membership_note: u.getString('membership_note') || '',
      birth_date: u.getString('birth_date'),
      legal_status: u.getString('legal_status'),
      school: u.getString('school'),
      city: u.getString('city'),
      graduation_year: u.getInt('graduation_year'),
      approved_at: u.getString('approved_at'),
      created: u.getString('created'),
      phone: u.getString('phone'),
    };
  }
  function text(value) {
    return value === undefined || value === null ? '' : String(value).trim();
  }
  var info = e.requestInfo();
  var headers = info.headers || {};
  var origin = text(headers['origin']);
  var host = text(e.request.host || headers['host']);
  if (
    origin &&
    host &&
    origin !== 'https://' + host &&
    origin !== 'http://' + host
  ) {
    return e.json(403, { error: 'İstek kaynağı doğrulanamadı.' });
  }

  var store = $app.store();
  var key = 'ghdpdf:login:' + e.realIP();
  var now = Date.now();
  var entry = store.get(key);
  if (!entry || !entry.reset || entry.reset < now) {
    store.set(key, { count: 1, reset: now + 60 * 1000 });
  } else {
    if (entry.count >= 15) {
      return e.json(429, {
        error: 'Çok fazla giriş denemesi. Bir dakika sonra tekrar deneyin.',
      });
    }
    entry.count = entry.count + 1;
    store.set(key, entry);
  }

  var body = info.body || {};
  var email = text(body.email).toLowerCase();
  var password = text(body.password);
  if (!email || !password) {
    return e.json(400, { error: 'E-posta ve şifre zorunludur.' });
  }

  var user;
  try {
    user = $app.findAuthRecordByEmail('users', email);
  } catch (notFound) {
    return e.json(401, { error: 'E-posta veya şifre hatalı.' });
  }
  if (!user.validatePassword(password)) {
    return e.json(401, { error: 'E-posta veya şifre hatalı.' });
  }

  var status = user.getString('membership_status') || 'pending';
  if (status === 'rejected') {
    return e.json(403, {
      error:
        user.getString('membership_note') ||
        'Üyelik başvurunuz reddedildi. Ayrıntı için dernekle iletişime geçin.',
      membership_status: status,
    });
  }

  e.setCookie(
    new Cookie({
      name: 'ghdpdf_auth',
      value: user.newAuthToken(),
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      secure:
        e.isTLS() ||
        String((e.requestInfo().headers || {})['x-forwarded-proto'] || '') ===
          'https',
      sameSite: 1,
    })
  );
  return e.json(200, { ok: true, user: userJson(user) });
});

routerAdd('POST', '/api/ghdpdf/logout', function (e) {
  e.setCookie(
    new Cookie({
      name: 'ghdpdf_auth',
      value: '',
      path: '/',
      maxAge: -1,
      httpOnly: true,
      secure:
        e.isTLS() ||
        String((e.requestInfo().headers || {})['x-forwarded-proto'] || '') ===
          'https',
      sameSite: 1,
    })
  );
  return e.json(200, { ok: true });
});

routerAdd('GET', '/cikis', function (e) {
  e.setCookie(
    new Cookie({
      name: 'ghdpdf_auth',
      value: '',
      path: '/',
      maxAge: -1,
      httpOnly: true,
      secure:
        e.isTLS() ||
        String((e.requestInfo().headers || {})['x-forwarded-proto'] || '') ===
          'https',
      sameSite: 1,
    })
  );
  return e.redirect(302, '/');
});

routerAdd('GET', '/api/ghdpdf/me', function (e) {
  function userJson(u) {
    return {
      id: u.id,
      name: u.getString('name'),
      email: u.getString('contact_email') || u.getString('email'),
      role: u.getString('role') || 'user',
      membership_status: u.getString('membership_status') || 'pending',
      membership_note: u.getString('membership_note') || '',
      birth_date: u.getString('birth_date'),
      legal_status: u.getString('legal_status'),
      school: u.getString('school'),
      city: u.getString('city'),
      graduation_year: u.getInt('graduation_year'),
      approved_at: u.getString('approved_at'),
      created: u.getString('created'),
      phone: u.getString('phone'),
    };
  }
  var cookies = e.request.cookiesNamed('ghdpdf_auth');
  var cookie = cookies && cookies.length ? cookies[0] : null;
  if (!cookie || !cookie.value) {
    return e.json(401, { error: 'Oturum bulunamadı.' });
  }
  var user;
  try {
    user = $app.findAuthRecordByToken(cookie.value, 'auth');
  } catch (err) {
    e.setCookie(
      new Cookie({
        name: 'ghdpdf_auth',
        value: '',
        path: '/',
        maxAge: -1,
        httpOnly: true,
        secure:
          e.isTLS() ||
          String((e.requestInfo().headers || {})['x-forwarded-proto'] || '') ===
            'https',
        sameSite: 1,
      })
    );
    return e.json(401, {
      error: 'Oturumun süresi dolmuş. Tekrar giriş yapın.',
    });
  }
  return e.json(200, { ok: true, user: userJson(user) });
});

/* ------------------------------------------------------------------ */
/* Yönetim uç noktaları                                                */
/* ------------------------------------------------------------------ */
routerAdd('GET', '/api/ghdpdf/admin/applications', function (e) {
  function userJson(u) {
    return {
      id: u.id,
      name: u.getString('name'),
      email: u.getString('contact_email') || u.getString('email'),
      role: u.getString('role') || 'user',
      membership_status: u.getString('membership_status') || 'pending',
      membership_note: u.getString('membership_note') || '',
      birth_date: u.getString('birth_date'),
      legal_status: u.getString('legal_status'),
      school: u.getString('school'),
      city: u.getString('city'),
      graduation_year: u.getInt('graduation_year'),
      approved_at: u.getString('approved_at'),
      created: u.getString('created'),
      phone: u.getString('phone'),
    };
  }
  function admin() {
    var cookies = e.request.cookiesNamed('ghdpdf_auth');
    var cookie = cookies && cookies.length ? cookies[0] : null;
    if (!cookie || !cookie.value) return null;
    try {
      var user = $app.findAuthRecordByToken(cookie.value, 'auth');
      if (user.getString('role') !== 'admin') return null;
      if (user.getString('membership_status') !== 'approved') return null;
      return user;
    } catch (err) {
      return null;
    }
  }
  if (!admin()) return e.json(401, { error: 'Yönetici girişi gerekli.' });

  var info = e.requestInfo();
  var status = info.query.status ? String(info.query.status) : 'pending';
  if (['pending', 'approved', 'rejected', 'all'].indexOf(status) === -1) {
    status = 'pending';
  }

  var filter = 'role != "admin"';
  var params = {};
  if (status !== 'all') {
    filter += ' && membership_status = {:status}';
    params.status = status;
  }

  var users;
  try {
    users = $app.findRecordsByFilter(
      'users',
      filter,
      '-created',
      200,
      0,
      params
    );
  } catch (err) {
    console.log('[ghdpdf] applications query failed:', err);
    return e.json(500, { error: 'Başvurular listelenemedi.' });
  }

  var applications = [];
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    var docs = [];
    try {
      var records = $app.findRecordsByFilter(
        'membership_documents',
        'user = {:uid}',
        'created',
        10,
        0,
        { uid: u.id }
      );
      for (var j = 0; j < records.length; j++) {
        docs.push({
          id: records[j].id,
          doc_type: records[j].getString('doc_type'),
          created: records[j].getString('created'),
        });
      }
    } catch (docErr) {
      console.log('[ghdpdf] document query failed:', docErr);
    }
    var item = userJson(u);
    item.documents = docs;
    applications.push(item);
  }

  return e.json(200, { ok: true, applications: applications });
});

routerAdd('GET', '/api/ghdpdf/admin/stats', function (e) {
  var cookies = e.request.cookiesNamed('ghdpdf_auth');
  var cookie = cookies && cookies.length ? cookies[0] : null;
  if (!cookie || !cookie.value)
    return e.json(401, { error: 'Yönetici girişi gerekli.' });
  var admin;
  try {
    admin = $app.findAuthRecordByToken(cookie.value, 'auth');
  } catch (err) {
    return e.json(401, { error: 'Yönetici girişi gerekli.' });
  }
  if (
    admin.getString('role') !== 'admin' ||
    admin.getString('membership_status') !== 'approved'
  ) {
    return e.json(401, { error: 'Yönetici girişi gerekli.' });
  }

  var users;
  try {
    users = $app.findRecordsByFilter(
      'users',
      'role != "admin"',
      '',
      1000,
      0,
      {}
    );
  } catch (err) {
    return e.json(500, { error: 'İstatistikler alınamadı.' });
  }
  var stats = { pending: 0, approved: 0, rejected: 0, total: users.length };
  for (var i = 0; i < users.length; i++) {
    var s = users[i].getString('membership_status') || 'pending';
    if (s === 'approved') stats.approved++;
    else if (s === 'rejected') stats.rejected++;
    else stats.pending++;
  }
  return e.json(200, stats);
});

routerAdd('POST', '/api/ghdpdf/admin/decision', function (e) {
  function userJson(u) {
    return {
      id: u.id,
      name: u.getString('name'),
      email: u.getString('contact_email') || u.getString('email'),
      role: u.getString('role') || 'user',
      membership_status: u.getString('membership_status') || 'pending',
      membership_note: u.getString('membership_note') || '',
      birth_date: u.getString('birth_date'),
      legal_status: u.getString('legal_status'),
      school: u.getString('school'),
      city: u.getString('city'),
      graduation_year: u.getInt('graduation_year'),
      approved_at: u.getString('approved_at'),
      created: u.getString('created'),
      phone: u.getString('phone'),
    };
  }
  var cookies = e.request.cookiesNamed('ghdpdf_auth');
  var cookie = cookies && cookies.length ? cookies[0] : null;
  if (!cookie || !cookie.value)
    return e.json(401, { error: 'Yönetici girişi gerekli.' });
  var admin;
  try {
    admin = $app.findAuthRecordByToken(cookie.value, 'auth');
  } catch (err) {
    return e.json(401, { error: 'Yönetici girişi gerekli.' });
  }
  if (
    admin.getString('role') !== 'admin' ||
    admin.getString('membership_status') !== 'approved'
  ) {
    return e.json(401, { error: 'Yönetici girişi gerekli.' });
  }

  var info = e.requestInfo();
  var headers = info.headers || {};
  var origin = String(headers['origin'] || '');
  var host = String(e.request.host || headers['host'] || '');
  if (
    origin &&
    host &&
    origin !== 'https://' + host &&
    origin !== 'http://' + host
  ) {
    return e.json(403, { error: 'İstek kaynağı doğrulanamadı.' });
  }

  var body = info.body || {};
  var userId = String(body.user_id || '').trim();
  var status = String(body.status || '').trim();
  var note = String(body.note || '').trim();
  if (!userId) return e.json(400, { error: 'Başvuru kimliği gerekli.' });
  if (status !== 'approved' && status !== 'rejected') {
    return e.json(400, { error: 'Geçerli bir karar seçin.' });
  }
  if (note.length > 1000)
    return e.json(400, { error: 'Not en fazla 1000 karakter olabilir.' });
  if (status === 'rejected' && !note) {
    return e.json(400, { error: 'Ret kararı için gerekçe yazılmalıdır.' });
  }
  if (userId === admin.id) {
    return e.json(400, {
      error: 'Kendi yönetici hesabınız için karar veremezsiniz.',
    });
  }

  var user;
  try {
    user = $app.findRecordById('users', userId);
  } catch (notFound) {
    return e.json(404, { error: 'Başvuru bulunamadı.' });
  }
  if (user.getString('role') === 'admin') {
    return e.json(400, {
      error: 'Yönetici hesapları bu ekrandan yönetilemez.',
    });
  }

  if (status === 'approved') {
    var docs;
    try {
      docs = $app.findRecordsByFilter(
        'membership_documents',
        'user = {:uid}',
        '',
        1,
        0,
        {
          uid: user.id,
        }
      );
    } catch (docErr) {
      docs = [];
    }
    if (!docs || docs.length === 0) {
      return e.json(400, { error: 'Belge yüklemeden üyelik onaylanamaz.' });
    }
    user.set('approved_at', new DateTime());
  } else {
    user.set('approved_at', '');
  }
  user.set('membership_status', status);
  user.set('membership_note', note);

  try {
    $app.save(user);
  } catch (err) {
    console.log('[ghdpdf] decision save failed:', err);
    return e.json(500, { error: 'Karar kaydedilemedi.' });
  }
  return e.json(200, { ok: true, user: userJson(user) });
});

routerAdd('GET', '/api/ghdpdf/admin/document', function (e) {
  var cookies = e.request.cookiesNamed('ghdpdf_auth');
  var cookie = cookies && cookies.length ? cookies[0] : null;
  if (!cookie || !cookie.value)
    return e.json(401, { error: 'Yönetici girişi gerekli.' });
  var admin;
  try {
    admin = $app.findAuthRecordByToken(cookie.value, 'auth');
  } catch (err) {
    return e.json(401, { error: 'Yönetici girişi gerekli.' });
  }
  if (
    admin.getString('role') !== 'admin' ||
    admin.getString('membership_status') !== 'approved'
  ) {
    return e.json(401, { error: 'Yönetici girişi gerekli.' });
  }

  var info = e.requestInfo();
  var id = info.query.id ? String(info.query.id) : '';
  if (!id) return e.json(400, { error: 'Belge kimliği gerekli.' });

  var doc;
  try {
    doc = $app.findRecordById('membership_documents', id);
  } catch (notFound) {
    return e.json(404, { error: 'Belge bulunamadı.' });
  }
  var filename = doc.getString('document');
  if (!filename) return e.json(404, { error: 'Belge dosyası bulunamadı.' });

  var dot = filename.lastIndexOf('.');
  var ext = dot >= 0 ? filename.substring(dot).toLowerCase() : '';
  var mime = 'application/octet-stream';
  if (ext === '.pdf') mime = 'application/pdf';
  else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
  else if (ext === '.png') mime = 'image/png';

  // PB dosya alanları storage/<collectionId>/<recordId>/<filename> altında.
  var filePath =
    $app.dataDir() +
    '/storage/' +
    doc.collection().id +
    '/' +
    doc.id +
    '/' +
    filename;
  var bytes;
  try {
    bytes = $os.readFile(filePath);
  } catch (readErr) {
    console.log('[ghdpdf] document read failed:', readErr);
    return e.json(404, { error: 'Belge dosyası okunamadı.' });
  }

  try {
    e.response
      .header()
      .set('Content-Disposition', 'inline; filename="' + filename + '"');
    e.response.header().set('Cache-Control', 'private, no-store');
  } catch (headerErr) {
    // Başlıklar desteklenmezse yalnızca dosya içeriği döner.
  }
  return e.blob(200, mime, bytes);
});

/* ------------------------------------------------------------------ */
/* /uygulama/* statik erişim kapısı                                    */
/* ------------------------------------------------------------------ */
routerUse(function (e) {
  var path = e.request.url.path;
  if (path.indexOf('/uygulama') !== 0) return e.next();

  if (path === '/uygulama') return e.redirect(308, '/uygulama/');

  var cookies = e.request.cookiesNamed('ghdpdf_auth');
  var cookie = cookies && cookies.length ? cookies[0] : null;
  if (cookie && cookie.value) {
    try {
      var user = $app.findAuthRecordByToken(cookie.value, 'auth');
      if (user.getString('membership_status') === 'approved') {
        var rest = path.slice('/uygulama/'.length);
        var langRoots = [
          'en',
          'ar',
          'be',
          'da',
          'ru',
          'de',
          'es',
          'fr',
          'id',
          'it',
          'nl',
          'pt',
          'pl',
          'sv',
          'tr',
          'vi',
          'zh',
          'zh-TW',
          'ko',
          'ja',
          'uk',
          'sk',
          'ca',
          'fa',
        ];
        if (rest.indexOf('/') === -1 && langRoots.indexOf(rest) !== -1) {
          return e.redirect(302, path + '/');
        }
        if (
          rest &&
          rest.charAt(rest.length - 1) !== '/' &&
          rest.indexOf('.') === -1
        ) {
          return e.redirect(302, path + '.html');
        }
        return e.next();
      }
    } catch (err) {
      // Geçersiz token: aşağıda kapıya düşer.
    }
  }

  var headers = e.requestInfo().headers || {};
  var accept = String(headers['accept'] || '');
  var isAsset =
    /\.(js|mjs|css|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|wasm|json|map|txt|pdf|webmanifest)$/i.test(
      path
    );
  if (!isAsset && accept.indexOf('text/html') !== -1) {
    return e.redirect(302, '/giris?next=' + encodeURIComponent(path));
  }
  return e.json(401, {
    error: 'Bu alan yalnızca onaylı dernek üyelerine açıktır.',
  });
});

/* ------------------------------------------------------------------ */
/* Savunma katmanı: API üzerinden doğrudan oluşturma/güncelleme        */
/* ------------------------------------------------------------------ */
onRecordCreateRequest(function (e) {
  if (e.hasSuperuserAuth()) return e.next();
  throw new ForbiddenError(
    'Başvurular yalnızca GH PDF başvuru formu üzerinden alınır.'
  );
}, 'users');

onRecordUpdateRequest(function (e) {
  if (e.hasSuperuserAuth()) return e.next();
  throw new ForbiddenError('Üyelik bilgileri yönetim tarafından güncellenir.');
}, 'users');

onRecordCreateRequest(function (e) {
  if (e.hasSuperuserAuth()) return e.next();
  throw new ForbiddenError(
    'Belgeler yalnızca başvuru formu üzerinden yüklenir.'
  );
}, 'membership_documents');
