# 🛠️ Developer Guide: Sekolahku

This guide provides technical instructions for setting up, developing, and deploying the Sekolahku project.

## 1. Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 20.19.0 or later (Required).
- **npm**: Package manager (usually comes with Node.js).
- **Git**: Version control system.
- **Docker** (Optional): For containerized deployment.

## 2. Installation & Setup

### Clone Repository
```bash
git clone https://github.com/your-username/sekolahku.git
cd sekolahku
```

### Install Dependencies
```bash
npm install
# or
npm ci # for clean install
```

### Environment Configuration
Copy the example environment file and configure it:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your local settings:
- `NEXT_PUBLIC_APP_URL`: URL of your local dev server (default: http://localhost:3000).
- `AUTH_SECRET`: Generate a random string for NextAuth (e.g., `openssl rand -base64 32`).
- `DATABASE_URL`: Path to your SQLite database (default: `file:./local.db`).

### Database Setup
Initialize the SQLite database using Drizzle Kit:

```bash
# Push schema to database (creates tables)
npx drizzle-kit push

# (Optional) Seed dummy data
npm run seed
```

## 3. Running the Application

### Development Mode
Starts the development server with hot-reloading.

```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

### Production Build
Builds the application for production usage.

```bash
npm run build
npm run start
```

### Docker
Run the application in a Docker container.

```bash
docker-compose up -d
```

## 4. Project Structure

```
sekolahku/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication routes (Login)
│   ├── (dashboard)/       # Protected application routes
│   │   ├── spmb-admin/    # SPMB Module
│   │   ├── perpustakaan/  # Library Module
│   │   ├── inventaris/    # Inventory Module
│   │   └── ...
│   ├── (public)/          # Public landing pages
│   └── api/               # API Routes (Next.js)
├── components/            # React Components
│   ├── ui/               # Shadcn UI (Reusable atoms)
│   ├── spmb/             # SPMB specific components
│   ├── library/          # Library specific components
│   └── ...
├── db/                    # Database Layer
│   ├── schema/           # Drizzle ORM Schema definitions
│   └── index.ts          # DB Connection setup
├── lib/                   # Utilities
│   ├── auth.ts           # NextAuth configuration
│   ├── utils.ts          # Helper functions
│   └── ...
├── public/                # Static assets (images, fonts)
├── scripts/               # Maintenance scripts
├── styles/                # Global CSS
├── types/                 # TypeScript type definitions
└── docs/                  # Documentation
```

## 5. Coding Standards & Conventions

Refer to [Project Context](PROJECT_CONTEXT.md) for detailed rules.

- **Language**: Use **Bahasa Indonesia** for all UI text.
- **Styling**: Use **Tailwind CSS**.
- **Components**: Prioritize **Shadcn UI**.
- **State Management**: Use **React Server Components** for data fetching, **Server Actions** for mutations, and **SWR** for client-side updates.
- **Type Safety**: Strictly use TypeScript. Define interfaces in `types/` or co-locate with components.
- **Database**: Use Drizzle ORM. Always define schema in `db/schema/`.

## 6. Database Management

We use **Drizzle ORM** with **SQLite**.

### Schema Changes
1. Modify files in `db/schema/`.
2. Run `npx drizzle-kit push` to apply changes.
3. Update `docs/DATABASE.md` to reflect changes.

### Studio
View and edit database content visually:
```bash
npx drizzle-kit studio
```

## 7. Testing

### Unit Tests (Vitest)
Run unit tests for logic and components.
```bash
npm run test
```

### End-to-End Tests (Playwright)
Run full browser automation tests.
```bash
# Install browsers first
npx playwright install

# Run tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui
```

## 8. Deployment

### Standalone Mode (Recommended)
Next.js standalone output optimizes for size and performance.

```bash
# 1. Build
npm run build

# 2. Run (with memory limit)
node .next/standalone/server.js
```

### Low-Spec Servers
See [Low Spec Deployment Guide](LOW-SPEC-DEPLOYMENT.md) for optimizing on 512MB/1GB VPS.

## 9. Troubleshooting

- **Database Locked**: Ensure no other process (like Drizzle Studio) is holding the lock.
- **Build Errors**: Check for type errors with `tsc --noEmit`.
- **Hydration Errors**: Ensure HTML structure is valid (e.g., no `<div>` inside `<p>`).

## 10. Contributing

1. Create a branch: `git checkout -b feature/my-feature`.
2. Commit changes: `git commit -m "feat: Add new dashboard widget"`.
3. Push: `git push origin feature/my-feature`.
4. Open a Pull Request.
