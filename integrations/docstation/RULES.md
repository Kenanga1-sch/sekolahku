# DocStation Development Rules

## Core Philosophy

Server HANYA bertindak sebagai proxy jaringan dan pengirim file statis. DILARANG menggunakan library pemrosesan gambar (seperti Python OpenCV, Pillow, atau Node Canvas) di backend server! Seluruh algoritma manipulasi gambar, stitching, enhancement, dan kompresi PDF WAJIB berjalan di browser client.

## Tech Stack

- **Backend Proxy:** Go (Echo/Gin) ATAU Python (FastAPI/Flask) — Ultra-lightweight dependencies.
- **Frontend Core:** Plain JavaScript (ES6+) / Web Components / Lightweight Framework.
- **Image Processing Engine:** `opencv.js` (dijalankan di Web Worker), HTML5 Canvas API.
- **PDF Generation Engine:** `pdf-lib` / `jsPDF`.
- **UI Styling:** Tailwind CSS (Mobile-First Layout).

## Technical Specifications & Standards

1. **Standard Page Dimensions:**
   - A4: $210\text{mm} \times 297\text{mm}$ ($595.28\text{pt} \times 841.89\text{pt}$)
   - F4 / Folio: $215\text{mm} \times 330\text{mm}$ ($609.45\text{pt} \times 935.43\text{pt}$)
   - Legal: $216\text{mm} \times 356\text{mm}$ ($612.00\text{pt} \times 1009.20\text{pt}$)
2. **eSCL Proxy Endpoint:** `/api/escl/*` -> forward ke `http://<PRINTER_IP>/eSCL/*`.
3. **Print Proxy Endpoint:** `/api/print` -> forward raw PDF bytes ke `<PRINTER_IP>:9100`.

## Code Guidelines

- Gunakan Web Worker terpisah untuk tugas berat OpenCV (Auto-Deskew, Perspective Warp, Auto-Stitch) agar UI thread tidak mengalami pembekuan (_freeze_).
- Sediakan fallback manual (Canvas Drag Pins / Micro Sliders) jika pendeteksian otomatis OpenCV gagal.
- Terapkan `Cache-Control: public, max-age=31536000` saat menyajikan file `opencv.js` dari server.
