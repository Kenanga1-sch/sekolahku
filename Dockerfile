FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata libc6-compat

# Mesin PDF opsional untuk tab Laporan Presensi (dipilih lewat menu Cetak ▾):
#   chromium       → POST /api/presensi/pdf/chromium    (HTML render → PDF)
#   libreoffice-calc → POST /api/presensi/pdf/libreoffice (isi template xlsx → PDF)
#   qpdf           → merge PDF bila "Semua Kelas" (>1 workbook)
# CATATAN: libreoffice-calc SAJA membuat soffice crash saat bootstrap di Alpine
# (RuntimeException di comphelper::ConfigurationWrapper::get → getProductName).
# Menambah libreoffice-writer memperbaikinya (terverifikasi: --version dan
# konversi xlsx→PDF jalan; paket lain: base/gtk/draw TIDAK membantu).
# Font: template presensi memakai "Arial Narrow" (Microsoft, tak ada di Linux) →
# di-alias ke Liberation Sans Narrow (metric-compatible) agar layout mendekati Excel;
# "Calibri" → Carlito (metric-compatible) — tanpa alias ini fontconfig memilih
# Open Sans (metrik beda) sehingga teks meluber dari kolom fixed-width di PDF;
# "Bookman Old Style" → Liberation Serif sebagai fallback yang stabil.
# Layer terpisah & ditaruh SEBELUM COPY binary: cache bertahan walau binary berubah.
RUN apk add --no-cache chromium libreoffice-calc libreoffice-writer qpdf \
        font-liberation font-liberation-sans-narrow font-carlito fontconfig && \
    printf '%s\n' \
      '<?xml version="1.0"?>' \
      '<!DOCTYPE fontconfig SYSTEM "fonts.dtd">' \
      '<fontconfig>' \
      '  <match target="pattern">' \
      '    <test qual="any" name="family"><string>Arial Narrow</string></test>' \
      '    <edit name="family" mode="assign" binding="strong"><string>Liberation Sans Narrow</string></edit>' \
      '  </match>' \
      '  <match target="pattern">' \
      '    <test qual="any" name="family"><string>Calibri</string></test>' \
      '    <edit name="family" mode="assign" binding="strong"><string>Carlito</string></edit>' \
      '  </match>' \
      '  <match target="pattern">' \
      '    <test qual="any" name="family"><string>Bookman Old Style</string></test>' \
      '    <edit name="family" mode="assign" binding="strong"><string>Liberation Serif</string></edit>' \
      '  </match>' \
      '</fontconfig>' \
      > /etc/fonts/conf.d/99-metric-aliases.conf && \
    fc-cache -f

WORKDIR /app

COPY sekolahku_linux /app/sekolahku

RUN chmod +x /app/sekolahku && \
    mkdir -p /app/data /app/uploads /app/public/uploads /app/public/uploads/templates /app/dist

# Catatan keamanan: image sengaja tetap berjalan sebagai uid 0 (root) di dalam
# container. Deploy memakai podman ROOTLESS: uid 0 container ter-map ke uid
# host 1000 (user biasa, bukan root host) lewat user namespace, sehingga
# "root" di container tidak punya hak istimewa di host. Pembatasan nyata
# diberikan oleh deploy.sh: --cap-drop=ALL, --security-opt no-new-privileges,
# --read-only (root fs tidak bisa ditulis), dan tmpfs /tmp.
#
# Memakai USER non-root (mis. 10001) di sini justru menyebabkan volume host
# (milik uid 1000) tidak bisa ditulis karena mapping subuid berbeda.

ENV PORT=8181
ENV TZ=Asia/Jakarta

EXPOSE 8181

CMD ["/app/sekolahku"]
