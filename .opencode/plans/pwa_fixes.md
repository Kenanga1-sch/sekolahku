# Plan: PWA Fixes & Mobile UI Improvements

## Goals

1. Fix PWA Install Button not showing on mobile devices (Android & iOS).
2. Add "Kembali ke Beranda" button on mobile login layout.
3. Remove duplicate school logo on mobile login page.

## Tasks

1. Update `components/pwa-install-button.tsx` with `iconOnly` prop and always show on mobile.
2. Update `app/(dashboard)/layout-client.tsx` to display install icon button on mobile header.
3. Update `app/(auth)/layout.tsx` to add "Kembali ke Beranda" button for mobile.
4. Update `app/(auth)/login/page.tsx` to remove duplicate logo block.
5. Build Next.js static export, sync dist, build Go binary, and deploy to production.
