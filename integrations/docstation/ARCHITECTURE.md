# Architecture & Data Flow DocStation

## System Topology

┌─────────────────────────────────────────────────────────────────────────┐
│ BROWSER CLIENT (HP / PC) │
│ ├── Download Static Assets & opencv.js (Cached) │
│ ├── eSCL Scan Client (via Proxy) │
│ ├── Web Worker (OpenCV.js Engine): │
│ │ ├── Auto-Deskew / Perspective Warp │
│ │ ├── Despeckle / Adaptive Binarization │
│ │ └── Auto-Stitch (Optional Tool) │
│ ├── Interactive Canvas Engine: │
│ │ ├── Micro-Fine Rotation (-10.0° to +10.0° step 0.1° + Grid Overlay) │
│ │ └── Manual Eraser / Crop / Contrast Sliders │
│ └── PDF Engine (pdf-lib): Render PDF (A4/F4) & Compress JPEG │
└────────────────────────────────────┬────────────────────────────────────┘
│
(HTTP API / PDF Binary Stream)
│
▼
┌─────────────────────────────────────────────────────────────────────────┐
│ SERVER PROXY (Go / Python) │
│ ├── Serve Static Files (HTML, JS, CSS, OpenCV.js) │
│ ├── Reverse Proxy eSCL (Bypass CORS) │
│ └── RAW Socket Forwarder (Port 9100 / IPP Port 631) │
└────────────────────────────────────┬────────────────────────────────────┘
│
(LAN Protocol: eSCL / RAW)
│
▼
┌─────────────────────────────────────────────────────────────────────────┐
│ CANON ALL-IN-ONE PRINTER (LAN) │
└─────────────────────────────────────────────────────────────────────────┘

## Data Flow (Scan -> Stitch -> Print)

1. Browser memuat aset statis + `opencv.js` (cached) dari Server Proxy.
2. Browser memanggil eSCL scan via proxy → server forward ke printer → JPEG binary stream kembali ke client.
3. Gambar diproses di Web Worker (OpenCV.js): auto-deskew, perspective warp, despeckle, adaptive binarization, auto-stitch.
4. Canvas Engine memberi kontrol manual: rotasi mikro (-10.0° s/d +10.0°, step 0.1°) + grid overlay, crop, eraser, contrast.
5. PDF Engine (`pdf-lib`) menyusun PDF presisi (A4/F4) dengan kompresi JPEG variabel.
6. Browser mengirim binary PDF via `POST /api/print` → Server forward RAW socket ke printer port 9100 (atau IPP 631).

## Endpoint API Contract

- `GET/POST /api/escl/{path}` : Proxy request eSCL ke printer.
- `POST     /api/print` : Menerima binary stream PDF -> kirim ke printer socket.
- `GET      /api/status` : Health check koneksi printer via ping/eSCL.
