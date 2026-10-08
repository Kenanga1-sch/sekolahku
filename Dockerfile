FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata libc6-compat

# Mesin PDF opsional untuk tab Laporan Presensi (dipilih lewat menu Cetak ▾):
#   chromium       → POST /api/presensi/pdf/chromium    (HTML render → PDF)
#   libreoffice-calc → POST /api/presensi/pdf/libreoffice (isi template xlsx → PDF)
#   qpdf           → merge PDF bila "Semua Kelas" (>1 workbook)
# Font: template presensi memakai "Arial Narrow" (Microsoft, tak ada di Linux) →
# di-alias ke Liberation Sans Narrow (metric-compatible) agar layout mendekati Excel.
# Layer terpisah & ditaruh SEBELUM COPY binary: cache bertahan walau binary berubah.
RUN apk add --no-cache chromium libreoffice-calc qpdf \
        font-liberation font-liberation-sans-narrow fontconfig && \
    printf '%s\n' \
      '<?xml version="1.0"?>' \
      '<!DOCTYPE fontconfig SYSTEM "fonts.dtd">' \
      '<fontconfig>' \
      '  <match target="pattern">' \
      '    <test qual="any" name="family"><string>Arial Narrow</string></test>' \
      '    <edit name="family" mode="assign" binding="strong"><string>Liberation Sans Narrow</string></edit>' \
      '  </match>' \
      '</fontconfig>' \
      > /etc/fonts/conf.d/99-arial-narrow.conf && \
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
