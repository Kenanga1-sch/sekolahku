# 🎓 Website Sekolah Terpadu

Modern school website built with Next.js 16, featuring integrated Library Management, Inventory System, and Online Student Registration (SPMB).

![Next.js](https://img.shields.io/badge/Next.js-16.1-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38bdf8?logo=tailwindcss)
![PocketBase](https://img.shields.io/badge/PocketBase-0.26-b8dbe4)

## ✨ Features

### 🎯 Core Modules
| Module | Description |
|--------|-------------|
| **SPMB** | Online student registration with zonasi map |
| **Perpustakaan** | Library management with kiosk mode |
| **Inventaris** | Asset management with stock opname |
| **Pengumuman** | News and announcements |

### 🔒 Security Features
- XSS Prevention (DOMPurify)
- Filter Injection Protection
- Rate Limiting
- Input Sanitization
- Role-Based Access Control

### ⚡ Performance Features
- SWR Caching
- Pagination
- Standalone Build (512MB RAM limit)
- Optimized Docker deployment

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/your-username/sekolahku.git
cd sekolahku

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your values

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
├── app/
│   ├── (public)/          # Public pages
│   ├── (auth)/            # Authentication
│   ├── (dashboard)/       # Admin dashboard
│   │   ├── perpustakaan/  # Library module
│   │   ├── inventaris/    # Inventory module
│   │   └── spmb-admin/    # SPMB management
│   └── api/               # API routes
├── components/
│   ├── providers/         # Context providers
│   ├── ui/                # Shadcn UI components
│   └── ...               # Feature components
├── hooks/
│   └── use-data.ts        # SWR data hooks
├── lib/
│   ├── pocketbase.ts      # PocketBase client
│   ├── security.ts        # Security utilities
│   ├── library.ts         # Library helpers
│   ├── inventory.ts       # Inventory helpers
│   └── toast.ts           # Toast notifications
└── types/                 # TypeScript definitions
```

## 🔧 Environment Variables

```env
# PocketBase
NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME="Website Sekolah Terpadu"

# Default Map Center
NEXT_PUBLIC_DEFAULT_LAT=-6.200000
NEXT_PUBLIC_DEFAULT_LNG=106.816666
```

## 🐳 Docker Deployment

### Quick Deploy
```bash
docker-compose up -d
```

### Memory Limits (For 4GB Server)
| Service | Memory Limit |
|---------|--------------|
| Next.js | 512 MB |
| PocketBase | 256 MB |

### Manual Production
```bash
npm run build
./start-production.sh
```

## 📝 Available Scripts

```bash
npm run dev         # Development server
npm run build       # Production build
npm run start       # Production server (default)
npm run start:prod  # Production with memory limits
npm run lint        # ESLint
npm run test        # Vitest unit tests
npm run test:e2e    # Playwright E2E tests
```

## 🗺️ Routes

### Public Routes
| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/profil/*` | School profile pages |
| `/berita` | News listing |
| `/spmb/daftar` | SPMB registration |
| `/spmb/tracking` | Status check |
| `/kiosk` | Library kiosk mode |

### Dashboard Routes (Protected)
| Route | Description |
|-------|-------------|
| `/overview` | Dashboard |
| `/spmb-admin` | Manage registrants |
| `/perpustakaan` | Library dashboard |
| `/inventaris` | Inventory dashboard |
| `/users` | User management |

## 📚 API Documentation

See [docs/API.md](docs/API.md) for detailed API documentation.

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# With UI
npm run test:e2e:ui
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

Built with ❤️ for Indonesian Education
