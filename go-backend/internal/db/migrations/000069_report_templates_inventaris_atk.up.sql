-- 000069_report_templates_inventaris_atk.up.sql
-- Seed template format laporan (schema v3, cell-based) untuk modul Inventaris:
-- Laporan Stok Barang Habis Pakai. Dipanggil modul inventaris via kode
-- RPT_INVENTARIS_HABIS_PAKAI (lihat lib/report-template-runner.ts).

INSERT OR REPLACE INTO report_templates
    (code, name, category, description, paper_size, orientation, layout_json, is_default, created_at, updated_at)
VALUES (
    'RPT_INVENTARIS_HABIS_PAKAI',
    'Laporan Stok Barang Habis Pakai',
    'Inventaris',
    'Rekapitulasi stok barang habis pakai (ATK) beserta harga dan nilai persediaan.',
    'A4',
    'portrait',
    '{"schemaVersion":3,"reportCode":"RPT_INVENTARIS_HABIS_PAKAI","reportName":"Laporan Stok Barang Habis Pakai","category":"Inventaris","paperSize":"A4","orientation":"portrait","showFooter":true,"density":"normal","margin":{"top":36,"bottom":45,"left":40,"right":40},"typography":{"baseFontSize":9,"tableFontSize":8,"lineHeight":1.4,"rowPadding":4,"blockGap":8},"headerRepeat":true,"sheets":[{"id":"sheet-atk","name":"Habis Pakai","cols":9,"colWidths":[28,80,200,90,45,40,50,90,100],"cells":{"0,0":{"value":"{{sekolah.governanceLine}}","bold":true,"align":"center","colSpan":9},"1,0":{"value":"{{sekolah.departmentLine}}","bold":true,"align":"center","colSpan":9},"2,0":{"value":"{{sekolah.schoolName}}","bold":true,"align":"center","fontSize":13,"colSpan":9},"3,0":{"value":"{{sekolah.address}} • Telp: {{sekolah.phone}}","align":"center","colSpan":9},"4,0":{"value":"LAPORAN STOK BARANG HABIS PAKAI","bold":true,"align":"center","fontSize":12,"colSpan":9},"5,0":{"value":"{{laporan.periode}}","align":"center","colSpan":9},"6,0":{"value":"No","bold":true,"align":"center","border":"all"},"6,1":{"value":"Kode","bold":true,"align":"center","border":"all"},"6,2":{"value":"Nama Barang","bold":true,"align":"center","border":"all"},"6,3":{"value":"Kategori","bold":true,"align":"center","border":"all"},"6,4":{"value":"Stok","bold":true,"align":"center","border":"all"},"6,5":{"value":"Min","bold":true,"align":"center","border":"all"},"6,6":{"value":"Satuan","bold":true,"align":"center","border":"all"},"6,7":{"value":"Harga","bold":true,"align":"center","border":"all"},"6,8":{"value":"Nilai","bold":true,"align":"center","border":"all"},"7,0":{"value":"{no}","align":"center","border":"all"},"7,1":{"value":"{code}","align":"left","border":"all"},"7,2":{"value":"{name}","align":"left","border":"all"},"7,3":{"value":"{category}","align":"left","border":"all"},"7,4":{"value":"{currentStock}","align":"center","border":"all"},"7,5":{"value":"{minStock}","align":"center","border":"all"},"7,6":{"value":"{unit}","align":"center","border":"all"},"7,7":{"value":"{price}","align":"right","format":"rupiah","border":"all"},"7,8":{"value":"{nilai}","align":"right","format":"rupiah","border":"all"},"8,0":{"value":"JUMLAH","bold":true,"align":"left","border":"all","colSpan":8},"8,8":{"value":"=SUM(I8:I8)","bold":true,"align":"right","format":"rupiah","border":"all"},"10,0":{"value":"Mengetahui,","align":"left"},"11,0":{"value":"Kepala Sekolah","bold":true,"align":"left"},"12,0":{"value":"{{principal.nama}}","bold":true,"align":"left"},"13,0":{"value":"NIP. {{principal.nip}}","align":"left"},"10,5":{"value":"Dicetak pada {{laporan.periode}}","align":"left","colSpan":4}}}]}',
    0,
    unixepoch(),
    unixepoch()
);

-- Ringkasan agregat header opsional (jenis & nilai) tersedia sebagai variabel
-- laporan.total_jenis / laporan.total_nilai bila format memakai keduanya.
