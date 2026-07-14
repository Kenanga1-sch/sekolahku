# syntax=docker/dockerfile:1

FROM node:20-alpine AS frontend-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY --from=frontend-deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL=""
ARG NEXT_PUBLIC_APP_URL=""
ARG NEXT_PUBLIC_APP_NAME="Website Sekolah Terpadu"

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN NODE_OPTIONS="--max-old-space-size=1024" npm run build

FROM golang:1.25-bookworm AS backend-builder
WORKDIR /src

COPY go-backend/go.mod go-backend/go.sum ./
RUN go mod download

COPY go-backend/ ./
COPY --from=frontend-builder /app/out ./cmd/api/dist

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/sekolahku ./cmd/api

FROM debian:bookworm-slim AS runner
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=backend-builder /out/sekolahku /app/sekolahku
RUN chmod +x /app/sekolahku \
    && mkdir -p /app/data /app/public/uploads /app/uploads

ENV PORT=8181
ENV TZ=Asia/Jakarta
EXPOSE 8181

CMD ["/app/sekolahku"]
