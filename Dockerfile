FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata libc6-compat

WORKDIR /app

COPY sekolahku_linux /app/sekolahku

RUN chmod +x /app/sekolahku && \
    mkdir -p /app/data /app/uploads /app/public/uploads

ENV PORT=3000
ENV TZ=Asia/Jakarta

EXPOSE 3000

CMD ["/app/sekolahku"]
