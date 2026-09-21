# Ruang Tumbuh — Skrining & Perkembangan Peserta Didik

Modul skrining game-based untuk identifikasi dini hambatan belajar. Prinsip: **measure, don't label**.

## Keputusan (sudah dikunci)
- 5 game: Tangkap Target (Perhatian), Jangan Terkecoh (Inhibitory), Ingat Urutannya (Working Memory), Kereta Kata (Literasi, visual + penilaian manual guru), Toko Buah (Numerasi).
- Area siswa di dalam `app/(dashboard)/ruang-tumbuh/` (nav Menu Siswa).
- Guru hanya screening kelas walinya (`student_classes.wali_user_id`); staff/admin agregat.
- Hasil = deskriptor metrik per dimensi (akurasi/kecepatan/konsistensi/omisi/level). TANPA flag otomatis, tanpa label medis (§41).
- Orang tua lengkap di MVP: kuesioner pengamatan + profil perkembangan + rekomendasi tindak lanjut.
- Periode = academic_year aktif (tidak ada tabel periode sendiri).
- 1 game per sesi. Teacher-controlled: siswa main hanya jika sesi kelasnya status=active.
- Bertahap per milestone, deploy dev setelah milestone.

## Milestone 1 — Fondasi + Tangkap Target + Alur Guru
- `000053_skrining.up/.down.sql`: skema lengkap (games, sessions, attempts, trials, results, teacher_observations, parent_observations, recommendations).
- Backend: models + repo + handlers (pola Bank Soal), wali-kelas scoping, audit log.
- Frontend: engine game (state machine, performance.now(), batch submit), Tangkap Target, halaman siswa, halaman guru (buat/kontrol sesi, progress live, observasi, hasil, dashboard kelas).

## Milestone 2 — 4 game sisanya
Jangan Terkecoh, Ingat Urutannya (level 2-6), Kereta Kata (visual auto-grade + input manual guru), Toko Buah (adaptif + error breakpoint).

## Milestone 3 — Orang tua + dashboard penuh
Kuesioner ortu di `app/parent/`, profil perkembangan (recharts), rekomendasi yang dibagikan, notifikasi undangan ortu, agregat staff.

## Konvensi wajib
- Trial mentah selalu disimpan + `game_version` tercatat (§22, §39).
- Catat device/browser/layar per attempt (§36).
- Tanpa leaderboard/komparasi (§44). UI ramah anak, sedikit teks, tombol besar (§45).
- Backend: cuid2 id, unix-ms timestamps, `created_at/updated_at/deleted_at INTEGER`, `idx_<table>_<col>`, `CREATE TABLE IF NOT EXISTS`.
