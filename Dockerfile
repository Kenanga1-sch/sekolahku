FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata libc6-compat

WORKDIR /app

COPY sekolahku_linux /app/sekolahku

RUN chmod +x /app/sekolahku && \
    mkdir -p /app/data /app/uploads /app/public/uploads

ENV PORT=8181
ENV TZ=Asia/Jakarta

EXPOSE 8181

CMD ["/app/sekolahku"]
