# Trizpyy API — small static Go binary on a minimal image.
FROM golang:alpine AS build
WORKDIR /src
ENV GOTOOLCHAIN=auto
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/api /api
ENV PORT=8080 APP_ENV=production
EXPOSE 8080
USER nonroot
ENTRYPOINT ["/api"]
