# Deep Codebase Analysis & Critique

## 1. Architectural Patterns

### The "Client-Side Fetching" Anti-Pattern (RESOLVED)

**Observation:** The application was heavily relying on `useEffect` to fetch data from its own API routes (`/api/homepage`, `/api/stats/overview`).
**Critique:** This pattern negates the benefits of Next.js App Router (Server Components). It causes:

- **Waterfall Requests:** Browser loads JS -> Executes JS -> Fetches API -> Renders.
- **Layout Shift / Flicker:** Users see Skeleton loaders unnecessarily.
- **SEO Impact:** Homepage content was hidden from crawlers that don't execute JS efficiently.

**Resolution:**

- Refactored `app/(public)/page.tsx` to a Server Component.
- Refactored `app/(dashboard)/overview/page.tsx` to a Server Component.
- Extracted data access logic to `lib/data/homepage.ts` and `lib/data/dashboard.ts`.
- Removed redundant API routes.

## 2. Database & Scalability

### SQLite Concurrency

**Observation:** The app uses `better-sqlite3`. While fast, SQLite has write concurrency limits.
**Critique:** High-traffic events (like mass SPMB registration) might hit `SQLITE_BUSY` errors.
**Recommendation:** Ensure WAL (Write-Ahead Logging) mode is enabled. (This is usually default in better-sqlite3 but good to verify).

### Indexing (GOOD)

**Observation:** Schema definitions in `db/schema` include appropriate indexes for `status`, `email`, and `role`.
**Critique:** Good job on proactive indexing.

## 3. Security

### Client-Side Rate Limiting (PARTIAL)

**Observation:** `lib/security.ts` contains `checkRateLimit` but it's a client-side or per-request utility.
**Critique:** A distributed implementation using Redis or Vercel KV would be better for production, but for a single-server setup, the current implementation is acceptable provided it's applied to all sensitive _mutations_ (POST/PUT/DELETE).

## 4. Code Quality

### Type Safety

**Observation:** Some API routes were manually typing `any` or loose objects.
**Resolution:** By moving logic to `lib/data/*`, we leverage TypeScript's inference from Drizzle ORM queries better, reducing runtime type errors.

---

**Status:** Major architectural flaws in the main pages have been fixed. The app is now significantly more performant and SEO-friendly.

- **Update:** Implemented `unstable_cache` for dashboard stats to reduce database load.
- **Update:** Added strict type definitions for System Health monitoring.

* **Update:** Refactored Document Uploads to use explicit schema (KK, Akte, KTP, etc.) instead of generic array, improving validation and UX.
* **UX Polish:** Refactored Document Upload form to use a Tabbed interface, separating Required and Supporting documents for a cleaner, symmetrical layout ("Tata letak lebih rapi").
* **UX Polish:** Implemented "Step-within-Step" navigation for Parent and Document forms. Clicking "Next" now cycles through tabs (Father -> Mother -> Guardian -> Contact) before changing the main Wizard step, ensuring users review all sections naturally.
* **UX Polish:** Enabled clickable Progress Indicators. Users can now click on previous step numbers (e.g., clicking "1" while on step 4) to quickly jump back and edit information ("Melompat ke belakang"), improving navigation flexibility.
* **UX Polish:** Enhanced Review Step to display full details for Father, Mother, and Guardian sections separately, replacing the previous simplified summary. matches the depth of the input forms.
* **Fix:** Resolved "Objects are not valid as a React child" error by sanitizing API error messages in `RegistrationPageClient`.
* **Fix:** Added defensive rendering in `RegistrationWizard` to safely handle non-string error objects, preventing UI crashes even if API returns unexpected formats.
* **Fix:** Implemented double-safeguard for array iterations in both API (Zod validation errors) and Client (Document uploads) to strictly prevent "Cannot read properties of undefined (reading 'forEach')" crashes'.
* **Feature:** Enhanced Error Feedback by exposing detailed validation messages (e.g., listing specific invalid fields like "NIK", "Nama") directly in the UI, enabling users to self-correct submission errors.
* **Fix:** Resolved Critical Field Mismatch where the client sent `nik` but the API strictly required `student_nik`, causing silent validation failures. Mapped these fields correctly in the payload.
* **Fix:** Corrected Document Upload iteration logic to handle the new structured `DocumentFormValues` object, ensuring files are actually sent to the server.
* **Fix:** Resolved API Validation mismatch. The `address` field is now optional in the schema, allowing the server to auto-generate it from the detailed address fields (`street`, `rt`, `rw`, etc.) sent by the client.
* **Update:** Standardized User Interface logic by creating `SPMBStatusBadge` and removing widespread duplication.
* **Verification:** Confirmed SQLite WAL mode is enabled in `db/index.ts`.
* **Polish:** Added custom `not-found.tsx` and `error.tsx` for better UX during failures.
* **Fix:** Reactivated Excel/PDF Export feature in SPMB Admin.
* **Accessibility:** Added `aria-label` to Gallery Lightbox navigation buttons for better screen reader support.
* **Compatibility:** Verified PWA support and added `<noscript>` fallback for JS-disabled browsers.
