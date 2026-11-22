/* eslint-disable */
/// <reference path="../pb_data/types.d.ts" />

/**
 * GH PDF — e-Devlet belgeleri.
 *
 * Öğrenci belgesi veya hukuk fakültesi diploması. Dosya korumalıdır; yalnızca
 * sahibi ve onaylı admin görüntüleyebilir. Public create/update/delete kapalı;
 * başvuru sırasında belge özel uç noktadan `$app.save` ile eklenir.
 */

const COLLECTION_ID = 'pbc_1795000010';
const OWNER_OR_ADMIN =
  '@request.auth.id != "" && (user = @request.auth.id || (@request.auth.role = "admin" && @request.auth.membership_status = "approved"))';

migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId('membership_documents');
      return;
    } catch (e) {
      // Koleksiyon yok; oluşturulacak.
    }

    app.save(
      new Collection({
        id: COLLECTION_ID,
        name: 'membership_documents',
        type: 'base',
        listRule: OWNER_OR_ADMIN,
        viewRule: OWNER_OR_ADMIN,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            id: 'relation_ghdpdf_doc_user',
            name: 'user',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            id: 'file_ghdpdf_doc_file',
            name: 'document',
            type: 'file',
            required: true,
            maxSelect: 1,
            maxSize: 10485760,
            mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
            protected: true,
          },
          {
            id: 'select_ghdpdf_doc_type',
            name: 'doc_type',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['student_certificate', 'diploma'],
          },
          {
            id: 'autodate_ghdpdf_doc_created',
            name: 'created',
            type: 'autodate',
            onCreate: true,
          },
          {
            id: 'autodate_ghdpdf_doc_updated',
            name: 'updated',
            type: 'autodate',
            onCreate: true,
            onUpdate: true,
          },
        ],
        indexes: [
          'CREATE INDEX idx_membership_documents_ghdpdf_user ON membership_documents (user)',
        ],
      })
    );
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('membership_documents'));
    } catch (e) {
      // Zaten yok.
    }
  }
);
