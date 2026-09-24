# Remote Access & Operator Guide — DocStation

Server ini telah berjalan di **port 8000** dan sudah terhubung ke printer Canon
`192.168.10.131` (port 9100 & IPP 631 online).

---

## 1) Akses LAN (tanpa beli domain — langsung pakai sekarang)

Dari perangkat apa saja di jaringan WiFi/LAN yang sama (mis. ponsel Anda):

```
http://192.168.10.145:8000
```

- Login dilewati (belum ada kata sandi) agar Anda langsung dapat mencoba scan & print.
- Semua proses gambar (stitch, enhancement, PDF) dijalankan di browser, jadi beban server ringan.

## 2) Akses internet publik via domain Cloudflare (opsional, rekomendasi)

Port 80, 443 sudah terbuka oleh UFW. Gunakan **Cloudflare Tunnel** (koneksi keluar, aman):

### Pilihan A — Token otomatis (paling mudah, lewat Dashboard Zero Trust)

1. Buka **Cloudflare Zero Trust → Networks → Tunnels → Create**.
2. Nama tunnel: `docstation`.
3. Pilih “Run on this machine”, salin **t-token** yang diberikan.
4. Tambahkan **Route / Public Hostname**: pilih domain Anda → arahkan ke
   `http://localhost:8000`.
5. Salin token, lalu di server jalankan:

   ```bash
   sudo -u kenanga cloudflared tunnel run --token <t-token-anda>
   ```

   Atau pasang sebagai layanan agar hidung otomatis:

   ```bash
   sudo cloudflared service install --token <t-token-anda>
   sudo systemctl enable --now cloudflared
   ```

### Pilihan B — Berkas konfigurasi (template siap pakai)

Gunakan berkas `cloudflared-config.yml.example` di folder proyek, ganti:

- `<TUNNEL-UUID>.json` → kredensial tunnel Anda,
- `docstation.example.com` → domain Anda.

Pasang ke `~/.cloudflared/docstation.yml`, lalu:

```bash
sudo cloudflared service install \
    --config ~/.cloudflared/docstation.yml \
    /etc/systemd/system/cloudflared-docstation.service
sudo systemctl enable --now cloudflared-docstation
```

## 3) Aktifkan otentikasi operator (WAJIB sebelum ekspos publik)

```bash
sudo tee /etc/default/docstation >/dev/null <<'EOF'
PRINTER_IP=192.168.10.131
DOCSTATION_PASSWORD=<kata-sandi-anda>
DOCSTATION_SESSION_SECRET=$(openssl rand -hex 16)
DOCSTATION_MAX_PRINT_MB=50
EOF
sudo systemctl restart docstation
```

Setelah itu, browser akan menampilkan layar login operator.

## 4) Perintah operasional server

```bash
sudo systemctl status docstation
sudo systemctl restart docstation
sudo journalctl -u docstation -f
sudo ufw status          # port 8000 sudah di-allowed
```

## 5) Pengembangan lokal (di mesin Anda)

```bash
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8000
```

Buka http://127.0.0.1:8000 — kode sumber statis (`static/`) dilayani langsung oleh server.
