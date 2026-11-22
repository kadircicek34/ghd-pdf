/* eslint-disable */
/// <reference path="../pb_data/types.d.ts" />

/**
 * GH PDF — üyelik alanları.
 *
 * Başvuru formunun zorunlu alanları: doğum tarihi, hukuk durumu, okul ve KVKK
 * onayı. Public API üzerinden kullanıcı oluşturma kapalıdır; başvurular
 * `pb_hooks/ghdpdf.pb.js` içindeki özel uç noktadan `$app.save` ile alınır.
 * Böylece istemci `role`, `membership_status` gibi yönetim alanlarını
 * gönderemez.
 */

const FIELDS = [
  {
    id: 'text_ghdpdf_phone',
    name: 'phone',
    type: 'text',
    required: false,
    max: 20,
  },
  { id: 'date_ghdpdf_birth', name: 'birth_date', type: 'date', required: true },
  {
    id: 'select_ghdpdf_legal',
    name: 'legal_status',
    type: 'select',
    required: true,
    maxSelect: 1,
    values: ['student', 'graduate'],
  },
  {
    id: 'text_ghdpdf_school',
    name: 'school',
    type: 'text',
    required: true,
    max: 160,
  },
  {
    id: 'text_ghdpdf_city',
    name: 'city',
    type: 'text',
    required: false,
    max: 80,
  },
  {
    id: 'number_ghdpdf_grad',
    name: 'graduation_year',
    type: 'number',
    required: false,
    min: 1950,
    max: 2100,
  },
  {
    id: 'text_ghdpdf_contact',
    name: 'contact_email',
    type: 'text',
    required: false,
    max: 254,
  },
  {
    id: 'bool_ghdpdf_kvkk',
    name: 'kvkk_consent',
    type: 'bool',
    required: true,
  },
  {
    id: 'select_ghdpdf_status',
    name: 'membership_status',
    type: 'select',
    required: false,
    maxSelect: 1,
    values: ['pending', 'approved', 'rejected'],
  },
  {
    id: 'text_ghdpdf_note',
    name: 'membership_note',
    type: 'text',
    required: false,
    max: 1000,
  },
  {
    id: 'date_ghdpdf_approved',
    name: 'approved_at',
    type: 'date',
    required: false,
  },
  {
    id: 'select_ghdpdf_role',
    name: 'role',
    type: 'select',
    required: false,
    maxSelect: 1,
    values: ['user', 'admin'],
  },
];

const INDEX =
  'CREATE INDEX idx_users_ghdpdf_status ON users (membership_status)';

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    for (const def of FIELDS) {
      if (!users.fields.find((f) => f.name === def.name)) {
        users.fields.add(new Field(def));
      }
    }

    users.indexes = (users.indexes || []).filter(
      (idx) => idx.indexOf('idx_users_ghdpdf_status') === -1
    );
    users.indexes.push(INDEX);

    // Yalnızca kendi kaydını okuyabilir; onaylı admin tüm üyeleri görebilir.
    users.listRule =
      'id = @request.auth.id || (@request.auth.role = "admin" && @request.auth.membership_status = "approved")';
    users.viewRule =
      'id = @request.auth.id || (@request.auth.role = "admin" && @request.auth.membership_status = "approved")';

    // Public create/update/delete kapalı. Başvuru, giriş ve yönetim işlemleri
    // özel uç noktalarda $app.save ile yapılır (API kurallarını atlar).
    users.createRule = null;
    users.updateRule = null;
    users.deleteRule = null;

    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    for (const def of FIELDS) {
      const field = users.fields.find((f) => f.name === def.name);
      if (field) users.fields.removeById(field.id);
    }
    users.indexes = (users.indexes || []).filter(
      (idx) => idx.indexOf('idx_users_ghdpdf_status') === -1
    );
    users.listRule = null;
    users.viewRule = null;
    users.createRule = '';
    users.updateRule = '';
    users.deleteRule = '';
    app.save(users);
  }
);
