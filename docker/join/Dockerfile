FROM golang:1.25-alpine AS builder

WORKDIR /chain
COPY chain/go.mod chain/go.sum ./
RUN go mod download
COPY chain/ .
RUN go build -o /usr/local/bin/localchaind ./cmd/localchaind

FROM alpine:latest

RUN apk add --no-cache curl jq bash

COPY --from=builder /usr/local/bin/localchaind /usr/local/bin/localchaind
COPY join.sh /join.sh
COPY docker/join/entrypoint.sh /entrypoint.sh

RUN chmod +x /join.sh /entrypoint.sh

ENV CHAIN_HOME=/root/.localchaind

ENTRYPOINT ["/entrypoint.sh"]
