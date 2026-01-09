# 🎓 Website Sekolah Terpadu

Modern school website built with Next.js 15, featuring online student registration (SPMB) with interactive zonasi map.

![Next.js](https://img.shields.io/badge/Next.js-16.1-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38bdf8?logo=tailwindcss)
![PocketBase](https://img.shields.io/badge/PocketBase-0.26-b8dbe4)

## ✨ Features

- **📝 SPMB Online** - Multi-step registration wizard with document upload
- **🗺️ Interactive Zonasi Map** - Real-time distance calculation using Leaflet + Turf.js
- **📊 Admin Dashboard** - Manage registrants, periods, and announcements
- **🌙 Dark Mode** - System-aware theme switching
- **📱 Responsive** - Mobile-first design
- **⚡ Fast** - Static generation + Turbopack

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
│   ├── (public)/          # Public pages (landing, profile, news)
│   ├── (auth)/            # Authentication (login, register)
│   ├── (dashboard)/       # Admin dashboard
│   └── api/               # API routes
├── components/
│   ├── layout/            # Navbar, Footer
│   ├── spmb/              # Registration wizard components
│   └── ui/                # Shadcn UI components
├── lib/
│   ├── pocketbase.ts      # PocketBase client
│   ├── utils.ts           # Utility functions
│   └── validations/       # Zod schemas
└── types/                 # TypeScript definitions
```

## 🔧 Environment Variables

```env
# PocketBase
NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME="Website Sekolah Terpadu"

# Default Map Center (Jakarta)
NEXT_PUBLIC_DEFAULT_LAT=-6.200000
NEXT_PUBLIC_DEFAULT_LNG=106.816666
```

## 📦 Tech Stack

| Category  | Technology                 |
| --------- | -------------------------- |
| Framework | Next.js 15 (App Router)    |
| Language  | TypeScript                 |
| Styling   | Tailwind CSS 4 + Shadcn UI |
| Backend   | PocketBase                 |
| Maps      | React Leaflet + Turf.js    |
| Forms     | React Hook Form + Zod      |
| Animation | Framer Motion              |

## 🗺️ Routes

### Public

- `/` - Landing page
- `/profil/visi-misi` - Vision & Mission
- `/profil/sejarah` - School history
- `/kontak` - Contact
- `/berita` - News listing
- `/spmb` - SPMB info
- `/spmb/daftar` - Registration form
- `/spmb/tracking` - Status check

### Admin

- `/overview` - Dashboard
- `/spmb-admin` - Manage registrants
- `/spmb-admin/periods` - Manage periods
- `/announcements` - Manage news
- `/school-settings` - Settings

### API

- `POST /api/spmb/register`
- `GET /api/spmb/status`
- `POST /api/spmb/upload`
- `GET/PUT /api/settings`

## 🐳 Docker

```bash
# Build and run
docker-compose up -d

# Or build image only
docker build -t sekolahku .
```

## 📝 Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
npm run test     # Run tests
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
