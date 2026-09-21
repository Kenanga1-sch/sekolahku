FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata libc6-compat

WORKDIR /app

COPY sekolahku_linux /app/sekolahku

RUN chmod +x /app/sekolahku && \
    mkdir -p /app/data /app/uploads /app/public/uploads /app/dist

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
