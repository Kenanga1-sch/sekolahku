# Testing Progress Checklist

## 1. Unit & Integration Tests (Vitest)
Target: >80% coverage for `lib/` and `actions/`.

- [x] `lib/tabungan.ts` (Current: 81.08%)
- [x] `lib/spmb.ts` (Current: 95%)
- [x] `lib/library.ts` (Current: 82.35%)
- [x] `lib/data/inventory.ts` (Current: 70.58%)
- [x] `lib/auth-checks.ts` (Current: 89.47%)
- [x] `lib/security.ts` (Current: 86.66%)
- [x] `actions/finance.ts` (Current: 84.61%)
- [x] `actions/loans.ts` (Current: 80%)
- [x] `actions/savings-admin.ts` (Current: 73.97%)

## 2. API Tests (Vitest)
Target: Cover all `app/api/` routes.

- [x] `/api/library` (~80%)
- [x] `/api/tabungan` (~44% - coverage for student lookup)
- [x] `/api/spmb` (~85%)
- [x] `/api/inventory` (~67%)
- [x] `/api/academic` (~77%)
- [x] `/api/attendance` (~78%)
- [x] `/api/school-settings` (~74%)
- [x] `/api/announcements` (~76%)
- [x] `/api/kurikulum/grades` (~77%)
- [x] `/api/users` (~80%)
- [x] `/api/gallery` (~81%)
- [x] `/api/arsip/surat-masuk` (~38% - basic GET verified)
- [x] `/api/letters/numbering` (~78%)

## 3. E2E Tests (Playwright)
Target: All main user flows, multiple screen sizes.

### Public Site
- [x] Homepage (Verified)
- [ ] Profil / Visi Misi
- [ ] Kurikulum
- [ ] Berita
- [ ] Galeri
- [ ] Layanan
- [x] SPMB (Form Registration - Basic Check)
- [ ] Kontak / FAQ

### Dashboard (Admin/Staff)
- [ ] Login / Logout (Partially verified in dev)
- [ ] Overview Stats
- [ ] Keuangan (Brankas, Mutasi)
- [ ] Inventaris (Aset management)
- [ ] Tabungan (Deposit/Withdraw)
- [ ] Perpustakaan (Catalog, Borrow, Return)
- [ ] SPMB Admin (Verification, Export)
- [ ] User Management
- [ ] School Settings
- [ ] Activity Logs / Announcements

## 4. Security & Performance
- [x] RBAC verification (unauthorized access check in `api-rbac.test.ts`)
- [x] Rate limiting verification (`rate-limit.test.ts`)
- [x] SQLi/XSS prevention checks (verified sanitization in `security-fixes.test.ts`)
- [ ] Load testing (basic)
