FROM localchain:latest

ENV NODE_NAME=seed-node
ENV CHAIN_HOME=/root/.localchaind

COPY docker/seed-node/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
