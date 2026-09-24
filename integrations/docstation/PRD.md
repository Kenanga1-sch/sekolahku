# Product Requirement Document (PRD) — DocStation

## 1. Executive Summary & Vision

DocStation adalah Web App terpusat berbasis jaringan lokal (LAN) untuk mengelola operasional pemindaian (scan), pencetakan (print), serta manipulasi dokumen digital secara mandiri. Menggunakan printer Canon All-in-One via LAN, DocStation memindahkan seluruh beban pemrosesan visual heavy ke browser client. Hal ini memungkinkan server berjalan pada hardware ultra low-end tanpa membebani memori dan CPU server.

## 2. Hardware & Network Constraints

- **Target Printer:** Canon All-in-One (misal IP Static: `192.168.1.100`).
  - Scan API: eSCL (HTTP REST).
  - Print Protocol: Direct RAW Socket (Port 9100) / IPP (Port 631).
- **Target Server:** Ultra Low-End Hardware (RAM < 512MB, CPU 1-Core).
- **Target Client:** Desktop & Mobile Web Browsers (Chrome, Safari, Edge).

## 3. Architecture & Workload Split

### A. Client-Side Engine (Browser)

1. **Geometric & Orientation:**
   - Coarse Rotation ($90^\circ, 180^\circ, 270^\circ$).
   - Auto-Deskew (deteksi kemiringan teks via Hough Transform di OpenCV.js).
   - Micro-Fine Rotation (slider $-10.0^\circ$ s/d $+10.0^\circ$ dengan presisi $0.1^\circ$ & alignment grid overlay).
   - 4-Point Perspective Warp (Auto/Manual corner detection untuk meratakkan dokumen miring).
2. **Color Processing & Illumination:**
   - Background Extraction (penghilang bayangan HP/lampu).
   - Adaptive Thresholding (Otsu/Sauvola) untuk hasil HVS putih bersih (Magic B&W).
   - Manual Contrast, Brightness, & Grayscale Adjustment.
3. **Restoration & Cleanup:**
   - Despeckle / Noise Reduction (Median Filter untuk menghapus bintik fotokopi).
   - Manual Eraser & Brush Tool pada Canvas.
   - Punch Hole Removal (penghapus bekas lubang binder).
4. **Document Utility Suite:**
   - Auto-Stitching (penyambung 2x A4 ke F4/banner panjang via OpenCV.js Web Worker).
   - Card Double-Sided Layout (penata KTP/SIM tampak depan & belakang dalam 1 lembar A4).
   - PDF Compiler & Compressor (pembentuk PDF berbagai ukuran: A4, Letter, F4/Folio $215\times330\text{mm}$, Legal via `pdf-lib`).

### B. Server-Side Engine (Lightweight Proxy Gateway)

1. **Static File Server:** Menyajikan aset HTML, JS, CSS, dan file `opencv.js` dengan HTTP Caching aktif.
2. **eSCL CORS Proxy:** Bridge HTTP REST `/api/escl/*` untuk membungkus komunikasi eSCL dari/ke printer.
3. **Print Spooler Proxy:** Endpoint `/api/print` untuk menerima binary PDF dari client dan meneruskannya ke Port 9100/IPP printer.

## 4. Key Performance Indicators (KPIs)

- RAM Server terpakai $\le 50\text{ MB}$ saat proses scan/enhancement/print berlangsung.
- Pemrosesan gambar 300 DPI di Web Worker selesai $\le 3\text{ detik}$ di browser client.
- UI berjalan mulus pada $60\text{ fps}$ tanpa lag saat penggeseran slider rotasi mikro/grid.
