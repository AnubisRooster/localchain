FROM localchain:latest

ENV NODE_NAME=validator
ENV MONIKER=validator
ENV CHAIN_HOME=/root/.localchaind

RUN apt-get update && apt-get install -y --no-install-recommends curl jq && rm -rf /var/lib/apt/lists/*

COPY docker/validator/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
