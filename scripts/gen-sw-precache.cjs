/**
 * Build-time precache generator untuk static export.
 *
 * Berjalan otomatis via npm `postbuild` setelah `next build` (output:"export")
 * menghasilkan direktori `out/`. Script ini:
 *  - memindai semua aset statis (.js/.css/.png/.svg/.ico/.woff2/.ttf) di out/
 *  - menyisipkan `self.__precacheManifest = [...]` di paling atas out/sw.js
 *    (sebelum deklarasi PRECACHE_ASSETS) supaya `cache.addAll` mencakup semua
 *    chunk Next.js, bukan hanya 4 file fallback
 *  - menulis ulang CACHE_NAME dengan content hash sehingga cache lama dikosongi
 *
 * Hasil akhir (out/sw.js) kemudian disalin ke go-backend/cmd/api/dist/sw.js
 * oleh build script .bat, dan kemudian diembed ke binary Go.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "out");
const SW_PATH = path.join(OUT_DIR, "sw.js");

const PRECACHE_EXT =
  /\.(js|css|mjs|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i;
const ALWAYS = [
  "/",
  "/offline",
  "/offline.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

/** Kumpulkan aset statis relatif dari OUT_DIR (hanya file, skip data Next.js). */
function collectAssets() {
  const assets = new Set(ALWAYS);
  if (!fs.existsSync(OUT_DIR)) {
    console.warn("[sw-precache] out/ tidak ditemukan; generator dilewati.");
    process.exit(0);
  }
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, name.name);
      if (name.isDirectory()) {
        // _next/data (RSC payload) & _next/static/chunks — chunks tetap dicache agar
        // navigasi client-side offline; lewatkan _next/data saja (runtime fetch).
        if (name.name === "_next" || name.name === "next-static") {
          walk(full);
        } else {
          walk(full);
        }
      } else if (PRECACHE_EXT.test(name.name)) {
        // Jangan precache service worker itu sendiri: menyimpan /sw.js di
        // Cache API dapat menunda deteksi update dari browser.
        if (name.name === "sw.js") continue;
        const rel = path.relative(OUT_DIR, full).replace(/\\/g, "/");
        if (name.name === "index.html") {
          const normalized =
            "/" + rel.replace(/index\.html$/, "").replace(/\/$/, "");
          assets.add(normalized || "/");
        } else {
          assets.add("/" + rel);
        }
      }
    }
  };
  walk(OUT_DIR);
  return Array.from(assets).sort();
}

/** Content hash (deterministic) dari daftar aset → bump cache tiap build berubah. */
function contentHash(assets) {
  let h = 0;
  for (const a of assets) {
    for (let i = 0; i < a.length; i++) {
      h = (h * 31 + a.charCodeAt(i)) | 0;
    }
  }
  return Math.abs(h).toString(36);
}

function writeSW(assets) {
  if (!fs.existsSync(SW_PATH)) {
    console.warn("[sw-precache] out/sw.js tidak ada; lewati.");
    return;
  }
  const hash = "v" + contentHash(assets);
  let sw = fs.readFileSync(SW_PATH, "utf8");

  // Ganti CACHE_NAME (netral kutip: template memakai " dan script lama memakai ').
  sw = sw.replace(
    /const CACHE_NAME = ["'][^"']*["'];/,
    `const CACHE_NAME = "sekolahku-${hash}";`,
  );

  // Inject manifest di PEMOCHA (sebelum const PRECACHE_ASSETS) supaya nilainya
  // benar-benar tersedia saat PRECACHE_ASSETS di-evaluasi.
  const json = JSON.stringify(assets);
  const inject = `self.__precacheManifest = ${json};\n`;
  if (/^self\.__precacheManifest\s*=/.test(sw)) {
    sw = sw.replace(/^self\.__precacheManifest\s*= [^;]+;/m, () =>
      inject.trim(),
    );
  } else {
    sw = inject + sw;
  }

  fs.writeFileSync(SW_PATH, sw, "utf8");
  console.log(
    `[sw-precache] ${assets.length} aset → CACHE_NAME=sekolahku-${hash}`,
  );

  // Sinkronkan out/ → dist/ agar binary Go embed versi terbaru.
  const DIST_DIR = path.join(ROOT, "go-backend", "cmd", "api", "dist");
  if (fs.existsSync(DIST_DIR)) {
    // Hapus isi dist/ lama agar file stale tidak menumpuk.
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
    fs.mkdirSync(DIST_DIR, { recursive: true });

    copyDir(OUT_DIR, DIST_DIR);

    // Verifikasi: pastikan jumlah file out/ == dist/.
    const countOut = countFiles(OUT_DIR);
    const countDist = countFiles(DIST_DIR);
    if (countOut !== countDist) {
      console.error(
        `[sw-precache] SYNC GAGAL: out/=${countOut} files, dist/=${countDist} files`,
      );
      process.exit(1);
    }
    console.log(`[sw-precache] out/ → dist/ synced (${countDist} files)`);
  }
}

/**
 * Hitung jumlah file secara rekursif.
 */
function countFiles(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      count += countFiles(path.join(dir, entry.name));
    } else {
      count++;
    }
  }
  return count;
}

/**
 * Rekursif copy direktori (tanpa dependency eksternal).
 */
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

writeSW(collectAssets());
