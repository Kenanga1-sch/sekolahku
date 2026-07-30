## [Sekolahku Unified Deployment Stabilization] - 2026-04-16

### 🚀 Deployment & Connectivity

- **Unified Binary**: Successfully stabilized the Go + Next.js unified deployment (`sekolahku.exe`).
- **Port Agnostic**: Updated frontend `GO_API_URL` to use relative paths, resolving port conflicts (now default 8181).
- **Static Export**: Fixed Next.js static export build process to correctly embed assets within the Go binary.

### 🔐 Authentication & RBAC

- **Role Consolidation**: Performed migration of `superadmin` privileges into a single `admin` role for simplicity.
- **Reactive Auth**: Implemented safe session refreshing during login to ensure dashboard menus appear instantly without manual refresh.
- **Database Integrity**: Fixed SQLite timestamp scanning errors (`sql: Scan error on column index...`) across all repositories using `SafeTime` utility.
