/// <reference path="../pb_data/types.d.ts" />

migrate((db) => {
    const dao = new Dao(db);

    // 1. Create tabungan_kelas
    const kelas = new Collection({
        name: 'tabungan_kelas',
        type: 'base',
        system: false,
        schema: [
            {
                name: 'nama',
                type: 'text',
                required: true,
                options: {
                    min: 1,
                    max: 20,
                },
            },
            {
                name: 'wali_kelas',
                type: 'relation',
                required: false,
                options: {
                    collectionId: '_pb_users_auth_',
                    cascadeDelete: false,
                    maxSelect: 1,
                },
            },
        ],
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.role = "admin"',
        updateRule: '@request.auth.role = "admin"',
        deleteRule: '@request.auth.role = "admin"',
    });
    dao.saveCollection(kelas);

    // 2. Create tabungan_siswa
    const siswa = new Collection({
        name: 'tabungan_siswa',
        type: 'base',
        system: false,
        schema: [
            {
                name: 'nisn',
                type: 'text',
                required: true,
                options: {
                    min: 10,
                    max: 10,
                    pattern: '^[0-9]{10}$',
                },
            },
            {
                name: 'nama',
                type: 'text',
                required: true,
                options: {
                    min: 2,
                    max: 100,
                },
            },
            {
                name: 'kelas_id',
                type: 'relation',
                required: true,
                options: {
                    collectionId: kelas.id,
                    cascadeDelete: false,
                    maxSelect: 1,
                },
            },
            {
                name: 'saldo_terakhir',
                type: 'number',
                required: false,
                options: {
                    min: 0,
                },
            },
            {
                name: 'qr_code',
                type: 'text',
                required: true,
            },
            {
                name: 'foto',
                type: 'file',
                required: false,
                options: {
                    maxSelect: 1,
                    maxSize: 5242880, // 5MB
                    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
                },
            },
            {
                name: 'is_active',
                type: 'bool',
                required: false,
            },
        ],
        indexes: [
            'CREATE UNIQUE INDEX idx_nisn ON tabungan_siswa (nisn)',
            'CREATE UNIQUE INDEX idx_qr_code ON tabungan_siswa (qr_code)',
        ],
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.role = "admin"',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.role = "admin"',
    });
    dao.saveCollection(siswa);

    // 3. Create tabungan_transaksi
    const transaksi = new Collection({
        name: 'tabungan_transaksi',
        type: 'base',
        system: false,
        schema: [
            {
                name: 'siswa_id',
                type: 'relation',
                required: true,
                options: {
                    collectionId: siswa.id,
                    cascadeDelete: false,
                    maxSelect: 1,
                },
            },
            {
                name: 'user_id',
                type: 'relation',
                required: true,
                options: {
                    collectionId: '_pb_users_auth_',
                    cascadeDelete: false,
                    maxSelect: 1,
                },
            },
            {
                name: 'tipe',
                type: 'select',
                required: true,
                options: {
                    values: ['setor', 'tarik'],
                    maxSelect: 1,
                },
            },
            {
                name: 'nominal',
                type: 'number',
                required: true,
                options: {
                    min: 1000,
                },
            },
            {
                name: 'status',
                type: 'select',
                required: true,
                options: {
                    values: ['pending', 'verified', 'rejected'],
                    maxSelect: 1,
                },
            },
            {
                name: 'catatan',
                type: 'text',
                required: false,
                options: {
                    max: 500,
                },
            },
            {
                name: 'verified_by',
                type: 'relation',
                required: false,
                options: {
                    collectionId: '_pb_users_auth_',
                    cascadeDelete: false,
                    maxSelect: 1,
                },
            },
            {
                name: 'verified_at',
                type: 'date',
                required: false,
            },
        ],
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.role = "admin" || @request.auth.role = "bendahara"',
        deleteRule: '@request.auth.role = "admin"',
    });
    dao.saveCollection(transaksi);

}, (db) => {
    const dao = new Dao(db);
    try {
        const transaksi = dao.findCollectionByNameOrId('tabungan_transaksi');
        dao.deleteCollection(transaksi);
    } catch (_) { }
    try {
        const siswa = dao.findCollectionByNameOrId('tabungan_siswa');
        dao.deleteCollection(siswa);
    } catch (_) { }
    try {
        const kelas = dao.findCollectionByNameOrId('tabungan_kelas');
        dao.deleteCollection(kelas);
    } catch (_) { }
});
